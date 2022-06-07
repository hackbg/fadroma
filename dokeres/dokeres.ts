import { basename, dirname } from 'path'
import { Readable, Writable } from 'stream'
import { Console, bold } from '@hackbg/konzola'
import Docker from 'dockerode'

export { Docker }

const console = Console('Dokeres')

/** Defaults to the `DOCKER_HOST` environment variable. */
export const socketPath = process.env.DOCKER_HOST || '/var/run/docker.sock'

/** Follow the output stream from a Dockerode container until it closes. */
export async function follow (
  dockerode: Docker,
  stream:    any,
  callback:  (data)=>void
) {
  await new Promise<void>((ok, fail)=>{
    dockerode.modem.followProgress(stream, complete, callback)
    function complete (err, _output) {
      if (err) return fail(err)
      ok()
    }
  })
}

/** Wrapper around Dockerode.
  * Used to optain `DokeresImage` instances. */
export class Dokeres {
  /** By default, creates an instance of Dockerode
    * connected to env `DOCKER_HOST`. You can also pass
    * your own Dockerode instance or socket path. */
  constructor (dockerode?: Docker|string) {
    if (!dockerode) {
      this.dockerode = new Docker({ socketPath })
    } else if (typeof dockerode === 'object') {
      this.dockerode = dockerode
    } else if (typeof dockerode === 'string') {
      this.dockerode = new Docker({ socketPath: dockerode })
    } else {
      throw new Error('Dokeres: invalid init')
    }
  }

  readonly dockerode: Docker

  image (
    name:        string|null,
    dockerfile:  string|null,
    extraFiles?: string[]
  ): DokeresImage {
    return new DokeresImage(this, name, dockerfile, extraFiles)
  }

  async container (id: string): Promise<DokeresContainer> {
    const container = await this.dockerode.getContainer(id)
    const info = await container.inspect()
    const image = new DokeresImage(this, info.Image)
    return Object.assign(new DokeresContainer(
      image,
      info.Name,
      undefined,
      info.Args,
      info.Path
    ), { container })
  }

}

/** Interface to a Docker image. */
export class DokeresImage {

  constructor (
    readonly dokeres:     Dokeres|null,
    readonly name:        string|null,
    readonly dockerfile:  string|null = null,
    readonly extraFiles:  string[]    = []
  ) {
    if (dokeres && !(dokeres instanceof Dokeres)) {
      throw new Error('DokeresImage: pass a Dokeres instance')
    }
    if (!name && !dockerfile) {
      throw new Error('DokeresImage: specify at least one of: name, dockerfile')
    }
  }

  get dockerode (): Docker {
    return this.dokeres.dockerode
  }

  _available = null
  async ensure () {
    if (this._available) {
      //console.info(bold('Already ensuring image from parallel build:'), this.name)
      return await this._available
    } else {
      console.info(bold('Ensuring image:'), this.name)
      return await (this._available = new Promise(async(resolve, reject)=>{
        const {name, dockerfile} = this
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
    await this.dockerode.getImage(this.name).inspect()
  }

  /** Throws if inspected image does not exist in Docker Hub. */
  async pull () {
    const { name, dockerode } = this
    await new Promise((ok, fail)=>{
      dockerode.pull(name, async (err, stream) => {
        if (err) return fail(err)
        await follow(dockerode, stream, (event) => {
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
    const { name, dokeres: { dockerode } } = this
    const dockerfile = basename(this.dockerfile)
    const context = dirname(this.dockerfile)
    const src = [dockerfile, ...this.extraFiles]
    const build = await dockerode.buildImage(
      { context, src },
      { t: this.name, dockerfile }
    )
    await follow(dockerode, build, (event) => {
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

  async run (name, options, command, entrypoint, outputStream?) {
    return await DokeresContainer.run(
      this,
      name,
      options,
      command,
      entrypoint,
      outputStream
    )
  }

}

export interface DokeresContainerOptions {
  env?:      Record<string, string>
  exposed?:  string[]
  mapped?:   Record<string, string>
  readonly?: Record<string, string>
  writable?: Record<string, string>
  extra?:    Record<string, unknown>
  remove?:   boolean
}

export type DokeresCommand = string|string[]

/** Interface to a Docker container. */
export class DokeresContainer {

  static async create (
    image:         DokeresImage,
    name?:         string,
    options?:      DokeresContainerOptions,
    command?:      DokeresCommand,
    entrypoint?:   DokeresCommand,
  ) {
    await image.ensure()
    const self = new this(image, name, options, command, entrypoint)
    await self.create()
    return self
  }

  static async run (
    image:         DokeresImage,
    name?:         string,
    options?:      DokeresContainerOptions,
    command?:      DokeresCommand,
    entrypoint?:   DokeresCommand,
    outputStream?: Writable
  ) {
    const self = await this.create(image, name, options, command, entrypoint)
    if (outputStream) {
      const stream = await self.container.attach({ stream: true, stdin: true, stdout: true })
      stream.setEncoding('utf8')
      stream.pipe(outputStream, { end: true })
    }
    await self.start()
    return self
  }

  constructor (
    readonly image:      DokeresImage,
    readonly name:       string,
    readonly options:    DokeresContainerOptions,
    readonly command:    DokeresCommand,
    readonly entrypoint: DokeresCommand
  ) {}

  container: Docker.Container

  get dockerode (): Docker {
    return this.image.dockerode
  }

  get dockerodeOptions (): Docker.ContainerCreateOptions {
    const {
      remove   = false,
      env      = {},
      exposed  = [],
      mapped   = {},
      readonly = {},
      writable = {},
      extra    = {}
    } = this.options
    const config = {
      Image:        this.image.name,
      Name:         this.name,
      Entrypoint:   this.entrypoint,
      Cmd:          this.command,
      Env:          Object.entries(env).map(([key, val])=>`${key}=${val}`),
      ExposedPorts: {},
      HostConfig:   { Binds: [], PortBindings: {}, AutoRemove: remove }
    }
    for (const containerPort of exposed) {
      config.ExposedPorts[containerPort] = { /*docker api needs empty object here*/ }
    }
    for (const [containerPort, hostPort] of Object.entries(mapped)) {
      config.HostConfig.PortBindings[containerPort] = {HostPort: hostPort}
    }
    for (const [hostPath, containerPath] of Object.entries(readonly)) {
      config.HostConfig.Binds.push(`${hostPath}:${containerPath}:ro`)
    }
    for (const [hostPath, containerPath] of Object.entries(writable)) {
      config.HostConfig.Binds.push(`${hostPath}:${containerPath}:rw`)
    }
    return {
      ...config,
      ...JSON.parse(JSON.stringify(extra)), // "smart" clone; `extra` overrides all
    }
  }

  get id (): string {
    return this.container.id
  }

  get shortId (): string {
    return this.container.id.slice(0, 8)
  }

  async create (): Promise<this> {
    if (this.container) {
      throw new Error('Container already created')
    }
    this.container = await this.dockerode.createContainer(this.dockerodeOptions)
    if (this.warnings) {
      console.warn(`Creating container ${this.shortId} emitted warnings:`)
      console.info(this.warnings)
    }
    return this
  }

  get warnings (): string[] {
    return (this.container as any).Warnings
  }

  async start (): Promise<this> {
    if (!this.container) await this.create()
    await this.container.start()
    return this
  }

  get isRunning (): Promise<boolean> {
    return this.container.inspect().then(({ State: { Running } })=>Running)
  }

  async kill (): Promise<this> {
    const id = this.shortId
    const prettyId = bold(id.slice(0,8))
    if (await this.isRunning) {
      console.info(`Stopping ${prettyId}...`)
      await this.dockerode.getContainer(id).kill()
      console.info(`Stopped ${prettyId}`)
    } else {
      console.warn(`Container already stopped: ${prettyId}`)
    }
    return this
  }

  async wait () {
    return await this.container.wait()
  }

}

/** The caveman solution to detecting when the node is ready to start receiving requests:
  * trail node logs until a certain string is encountered */
export function waitUntilLogsSay (
  container: Docker.Container,
  expected:  string,
  thenDetach  = true,
  waitSeconds = 7,
  logFilter   = (data: string) => true
) {
  console.info('Waiting for logs to say:', expected)
  return new Promise((ok, fail)=>{
    container.logs({ stdout: true, stderr: true, follow: true, tail: 100 }, (err, stream: Readable) => {
      if (err) return fail(err)
      console.info('Trailing logs...')
      stream.on('error', error => fail(error))
      stream.on('data', function ondata (data) {
        const dataStr = String(data).trim()
        if (logFilter(dataStr)) {
          console.info(bold(`${container.id.slice(0,8)} says:`), dataStr)
        }
        if (dataStr.indexOf(expected)>-1) {
          console.info(bold(`Found expected message:`), expected)
          stream.off('data', ondata)
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
