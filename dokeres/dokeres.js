import { Console, bold } from '@hackbg/konzola'
const console = Console('Dokeres')

import * as Docker from 'dockerode'
export { Docker }

import { basename, dirname } from 'path'

async function follow ({ modem }, stream, callback) {
  await new Promise((ok, fail)=>{
    modem.followProgress(stream, complete, callback)
    function complete (err, _output) {
      if (err) return fail(err)
      ok()
    }
  })
}

export const socketPath = process.env.DOCKER_HOST || '/var/run/docker.sock'

export class Dokeres {
  constructor (dockerode) {
    if (!dockerode) {
      this.dockerode = new Docker.Docker({ socketPath })
    } else if (typeof dockerode === 'object') {
      this.dockerode = dockerode
    } else if (typeof dockerode === 'string') {
      this.dockerode = new Docker.Docker({ socketPath: dockerode })
    } else {
      throw new Error('Dokeres: invalid init')
    }
  }
  dockerode
  image (name = null, dockerfile = null, extraFiles = []) {
    return new DockerImage(this, name, dockerfile, extraFiles)
  }
}

/** Represents a docker image for builder or devnet,
  * and can ensure its presence by pulling or building. */
export class DokeresImage {

  constructor (
    docker     = new Dokeres(),
    name       = null,
    dockerfile = null,
    extraFiles = []
  ) {
    if (!docker) {
      throw new Error('DokeresImage: pass a Dokeres instance')
    }
    if (!name && !dockefile) {
      throw new Error('DokeresImage: specify at least one of: name, dockerfile')
    }
    this.docker     = docker
    this.name       = name
    this.dockerfile = dockerfile
    this.extraFiles = extraFiles
  }

  _available = null
  async ensure () {
    if (this._available) {
      //console.info(bold('Already ensuring image from parallel build:'), this.name)
      return await this._available
    } else {
      console.info(bold('Ensuring image:'), this.name)
      return await (this._available = new Promise(async(resolve, reject)=>{
        const {docker, name, dockerfile, extraFiles} = this
        const PULLING  = `Image ${name} not found, pulling...`
        const BUILDING = `Image ${name} not found upstream, building...`
        const NO_FILE  = `Image ${name} not found and no Dockerfile provided; can't proceed.`
        try {
          await this.check()
        } catch (_e) {
          try {
            console.warn(`${PULLING} ${_e.message}`)
            await this.pull()
          } catch (e) {
            if (!dockerfile) {
              reject(`${NO_FILE} (${e.message})`)
            } else {
              console.warn(`${BUILDING} ${_e.message}`)
              console.info(bold('Using dockerfile:'), this.dockerfile)
              await this.build()
            }
          }
        }
        return resolve(name)
      }))
    }
  }

  /** Throws if inspected image does not exist locally. */
  async check () {
    await this.docker.getImage(this.name).inspect()
  }

  /** Throws if inspected image does not exist in Docker Hub. */
  async pull () {
    const { name, docker, dockerfile } = this
    await new Promise((ok, fail)=>{
      docker.pull(name, async (err, stream) => {
        if (err) return fail(err)
        await follow(this.docker, stream, (event) => {
          if (event.error) {
            console.error(event.error)
            throw new Error(`Pulling ${name} failed.`)
          }
          console.info(
            `📦 docker pull says:`,
            ['id', 'status', 'progress'].map(x=>event[x]).join('│')
          )
        })
      })
    })
  }

  /* Throws if the build fails, and then you have to fix stuff. */
  async build () {
    const { name, docker } = this
    const dockerfile = basename(this.dockerfile)
    const context    = dirname(this.dockerfile)
    const src        = [dockerfile, ...this.extraFiles]
    await follow(
      await docker.buildImage(
        { context, src },
        { t: this.name, dockerfile }
      ),
      (event) => {
        if (event.error) {
          console.error(event.error)
          throw new Error(`Building ${name} from ${dockerfile} in ${context} failed.`)
        }
        console.info(
          `📦 docker build says:`,
          event.progress || event.status || event.stream || JSON.stringify(event)
        )
      })
  }

  async run (name, options, command, entrypoint) {
    await this.ensure()
    return await DockerContainer.run(
      this,
      name,
      options,
      command,
      entrypoint
    )
  }

}

export class DokeresContainer {

  static buildConfig (
    imageName,
    name,
    options = {
      env:      {},
      exposed:  [],
      mapped:   {},
      readonly: {},
      writable: {},
      extra:    {}
    },
    command,
    entrypoint,
  ) {
    const config = {
      ...JSON.parse(JSON.stringify((options||{}).extra||{})), // "smart" clone
      Image:      imageName,
      Name:       name,
      Entrypoint: entrypoint,
      Cmd:        command,
      Env:        Object.entries(options.env).map(([key, val])=>`${key}=${val}`),
    }
    config.ExposedPorts     = config.ExposedPorts     || []
    config.HostConfig       = config.HostConfig       || {}
    config.HostConfig.Binds = config.HostConfig.Binds || []
    for (const containerPort of options.exposed) {
      config.ExposedPorts[containerPort] = { /*docker api needs empty object here*/ }
    }
    for (const [containerPort, hostPort] of Object.entries(options.mapped)) {
      config.HostConfig.PortBindings[container] = {HostPort: host}
    }
    for (const [hostPath, containerPath] of Object.entries(options.readonly)) {
      config.HostConfig.Binds.push(`${hostPath}:${containerPath}:ro`)
    }
    for (const [hostPath, containerPath] of Object.entries(options.writable)) {
      config.HostConfig.Binds.push(`${hostPath}:${containerPath}:rw`)
    }
    return config
  }

  static async run (
    image, name, options, command, entrypoint,
  ) {
    const config = buildConfig(image.name, name, options, command, entrypoint)
    await image.ensure()
    const self = new this(image, name, options, command, entrypoint)
    await self.create()
    await self.start()
    return self
  }

  constructor (image, name, options, command, entrypoint) {
    this.docker    = image.docker || new Docker({ socketPath })
    this.image     = image
    this.config    = buildConfig(image.name, name, options, command, entrypoint)
  }

  docker
  image
  config
  container

  get id () {
    return this.container.id
  }

  get shortId () {
    return this.container.id.slice(0, 8)
  }

  async create () {
    if (this.container) {
      throw new Error('Container already created')
    }
    this.container = await this.docker.createContainer(config)
    if (this.warnings) {
      console.warn(`Creating container ${this.shortId} emitted warnings:`)
      console.info(this.warnings)
    }
    return this
  }

  get warnings () {
    return this.container.Warnings
  }

  async start () {
    if (!this.container) await this.create()
    await this.container.start()
    return this
  }

  get isRunning () {
    const { State: { Running } } = await this.container.inspect()
    return Running
  }

  async kill () {
    const id = this.shortId
    const prettyId = bold(id.slice(0,8))
    if (await this.isRunning(id)) {
      console.info(`Stopping ${prettyId}...`)
      await this.docker.getContainer(id).kill()
      console.info(`Stopped ${prettyId}`)
    } else {
      console.warn(`Container already stopped: ${prettyId}`)
    }
    return this
  }

  async wait () {
    await this.container.wait()
    return this
  }

}

/** The caveman solution to detecting when the node is ready to start receiving requests:
  * trail node logs until a certain string is encountered */
export function waitUntilLogsSay (
  container   = { id: null, logs: () => { throw new Error('pass a container') } },
  expected    = '',
  thenDetach  = true,
  waitSeconds = 7
) {
  console.info('Waiting for logs to say:', expected)
  return new Promise((ok, fail)=>{
    container.logs({ stdout: true, stderr: true, follow: true, tail: 100 }, (err, stream) => {
      if (err) return fail(err)
      console.info('Trailing logs...')
      stream.on('error', error => fail(error))
      stream.on('data', data => {
        const dataStr = String(data).trim()
        if (logFilter(dataStr)) {
          console.info(bold(`${container.id.slice(0,8)} says:`), dataStr)
        }
        if (dataStr.indexOf(expected)>-1) {
          if (thenDetach) stream.destroy()
          if (waitSeconds > 0) {
            console.info(bold(`Waiting ${waitSeconds} seconds`), `for good measure...`)
            return setTimeout(ok, waitSeconds * 1000)
          }
        }
      })
    })
  })
}

const RE_GARBAGE = /[\x00-\x1F]/

function logFilter (data) {
  return (data.length > 0                            &&
          !data.startsWith('TRACE ')                 &&
          !data.startsWith('DEBUG ')                 &&
          !data.startsWith('INFO ')                  &&
          !data.startsWith('I[')                     &&
          !data.startsWith('Storing key:')           &&
          !RE_GARBAGE.test(data)                     &&
          !data.startsWith('{"app_message":')        &&
          !data.startsWith('configuration saved to') &&
          !(data.length>1000))}
