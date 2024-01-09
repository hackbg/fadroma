import { Engine, Image, Container } from './dock-base'
import type { ContainerOpts, ContainerCommand } from './dock-base'
import { DockError as Error, DockConsole as Console, bold } from './dock-events'

import { Readable, Writable, Transform } from 'node:stream'
import { basename, dirname } from 'node:path'

import Docker from 'dockerode'
export { Docker }

const console = new Console('@fadroma/oci: Docker')

export interface DockerHandle {
  getImage:         Function
  buildImage:       Function
  getContainer:     Function
  pull:             Function
  createContainer:  Function
  run:              Function
  modem: {
    host?:          string
    socketPath?:    string
    followProgress: Function,
  },
}

/** Defaults to the `DOCKER_HOST` environment variable. */
export const defaultSocketPath = process.env.DOCKER_HOST || '/var/run/docker.sock'

class DockerEngine extends Engine {

  static mock (callback?: Function) {
    return new this(mockDockerode(callback))
  }

  readonly dockerode: DockerHandle

  /** By default, creates an instance of Dockerode
    * connected to env `DOCKER_HOST`. You can also pass
    * your own Dockerode instance or socket path. */
  constructor (dockerode?: DockerHandle|string) {
    if (!dockerode) {
      dockerode = new Docker({ socketPath: defaultSocketPath })
    } else if (typeof dockerode === 'object') {
      dockerode = dockerode
    } else if (typeof dockerode === 'string') {
      dockerode = new Docker({ socketPath: dockerode })
    } else {
      throw new Error('invalid docker engine configuration')
    }
    const api = dockerode.modem.host ?? dockerode.modem.socketPath
    super(api)
    this.dockerode = dockerode
  }

  image (
    name:        string|null,
    dockerfile?: string|null,
    extraFiles?: string[]
  ): DockerImage {
    return new DockerImage(this, name, dockerfile, extraFiles)
  }

  async container (id: string): Promise<DockerContainer> {
    const container = await this.dockerode.getContainer(id)
    const info = await container.inspect()
    const image = this.image(info.Image)
    return Object.assign(new DockerContainer(
      image,
      info.Name,
      undefined,
      info.Args,
      info.Path
    ), { container })
  }
}

class DockerImage extends Image {

  constructor (
    engine:     DockerEngine|null,
    name:       string|null,
    dockerfile: string|null = null,
    extraFiles: string[]    = []
  ) {
    if (engine && !(engine instanceof DockerEngine)) throw new Error.NotDockerode()
    if (!name && !dockerfile) throw new Error.NoNameNorDockerfile()
    super(engine, name, dockerfile, extraFiles)
  }

  declare engine:
    DockerEngine

  get dockerode (): Docker {
    if (!this.engine || !this.engine.dockerode) throw new Error.NoDockerode()
    return this.engine.dockerode as unknown as Docker
  }

  async check () {
    if (!this.name) throw new Error.NoName('inspect')
    await this.dockerode.getImage(this.name).inspect()
  }

  /** Throws if inspected image does not exist in Docker Hub. */
  async pull () {
    const { name, dockerode } = this
    if (!name) throw new Error.NoName('pull')
    await new Promise<void>((ok, fail)=>{
      const log = new Console(`pulling docker image ${this.name}`)
      dockerode.pull(name, async (err: any, stream: any) => {
        if (err) return fail(err)
        await follow(dockerode, stream, (event) => {
          if (event.error) {
            log.error(event.error)
            throw new Error.PullFailed(name)
          }
          const data = ['id', 'status', 'progress'].map(x=>event[x]).join(' ')
          this.log.log(data)
        })
        ok()
      })
    })
  }

  /* Throws if the build fails, and then you have to fix stuff. */
  async build () {
    if (!this.dockerfile) throw new Error.NoDockerfile()
    if (!this.engine?.dockerode) throw new Error.NoDockerode()
    const { name, engine: { dockerode } } = this
    const dockerfile = basename(this.dockerfile)
    const context = dirname(this.dockerfile)
    const src = [dockerfile, ...this.extraFiles]
    const build = await dockerode.buildImage(
      { context, src },
      { t: this.name, dockerfile }
    )
    const log = new Console(`building docker image ${this.name}`)
    await follow(dockerode, build, (event) => {
      if (event.error) {
        log.error(event.error)
        throw new Error.BuildFailed(name??'(no name)', dockerfile, context)
      }
      const data = event.progress || event.status || event.stream || JSON.stringify(event) || ''
      console.log(data.trim())
    })
  }

  async run (
    name?:         string,
    options?:      Partial<ContainerOpts>,
    command?:      ContainerCommand,
    entrypoint?:   ContainerCommand,
    outputStream?: Writable
  ) {
    return await DockerContainer.run(
      this,
      name,
      options,
      command,
      entrypoint,
      outputStream
    )
  }

  container (
    name?:       string,
    options?:    Partial<ContainerOpts>,
    command?:    ContainerCommand,
    entrypoint?: ContainerCommand,
  ) {
    return new DockerContainer(
      this,
      name,
      options,
      command,
      entrypoint
    )
  }

}

class DockerContainer extends Container {

  container: Docker.Container|null = null

  declare image: DockerImage

  get dockerode (): Docker {
    return this.image.dockerode as unknown as Docker
  }

  get dockerodeOpts (): Docker.ContainerCreateOptions {

    const {
      remove   = false,
      env      = {},
      exposed  = [],
      mapped   = {},
      readonly = {},
      writable = {},
      extra    = {},
      cwd
    } = this.options

    const config = {
      name: this.name,
      Image: this.image.name,
      Entrypoint: this.entrypoint,
      Cmd: this.command,
      Env: Object.entries(env).map(([key, val])=>`${key}=${val}`),
      WorkingDir: cwd,
      ExposedPorts: {} as Record<string, {}>,
      HostConfig: {
        Binds: [] as Array<string>,
        PortBindings: {} as Record<string, Array<{ HostPort: string }>>,
        AutoRemove: remove
      }
    }

    exposed
      .forEach(containerPort=>
        config.ExposedPorts[containerPort] = {})

    Object.entries(mapped)
      .forEach(([containerPort, hostPort])=>
        config.HostConfig.PortBindings[containerPort] = [{ HostPort: hostPort }])

    Object.entries(readonly)
      .forEach(([hostPath, containerPath])=>
        config.HostConfig.Binds.push(`${hostPath}:${containerPath}:ro`))

    Object.entries(writable)
      .forEach(([hostPath, containerPath])=>
        config.HostConfig.Binds.push(`${hostPath}:${containerPath}:rw`))

    return Object.assign(config, JSON.parse(JSON.stringify(extra)))

  }

  get id (): string {
    if (!this.container) throw new Error.NoContainer()
    return this.container.id
  }

  get shortId (): string {
    if (!this.container) throw new Error.NoContainer()
    return this.container.id.slice(0, 8)
  }

  get warnings (): string[] {
    if (!this.container) throw new Error.NoContainer()
    return (this.container as any).Warnings
  }

  get isRunning (): Promise<boolean> {
    return this.inspect().then(state=>state.State.Running)
  }

  get ip (): Promise<string> {
    return this.inspect().then(state=>state.NetworkSettings.IPAddress)
  }

  async create (): Promise<this> {
    if (this.container) throw new Error.ContainerAlreadyCreated()

    // Specify the container
    const opts = this.dockerodeOpts

    this.image.log.creatingContainer(opts.name)

    // Log mounted volumes
    this.log.boundVolumes(opts?.HostConfig?.Binds ?? [])

    // Log exposed ports
    for (const [containerPort, config] of Object.entries(opts?.HostConfig?.PortBindings ?? {})) {
      for (const { HostPort = '(unknown)' } of config as Array<{HostPort: unknown}>) {
        this.log.boundPort(containerPort, HostPort)
      }
    }

    // Create the container
    this.container = await this.dockerode.createContainer(opts)

    // Update the logger tag with the container id
    this.log.label = this.name
      ? `DockerContainer(${this.container.id} ${this.name})`
      : `DockerContainer(${this.container.id})`

    // Display any warnings emitted during container creation
    if (this.warnings) {
      this.log.createdWithWarnings(this.shortId, this.warnings)
    }

    return this
  }

  async remove (): Promise<this> {
    if (this.container) await this.container.remove()
    this.container = null
    return this
  }

  async start (): Promise<this> {
    if (!this.container) await this.create()
    await this.container!.start()
    return this
  }

  inspect () {
    if (!this.container) throw new Error.NoContainer()
    return this.container.inspect()
  }

  async kill (): Promise<this> {
    if (!this.container) throw new Error.NoContainer()
    const id = this.shortId
    const prettyId = bold(id.slice(0,8))
    if (await this.isRunning) {
      console.log(`Stopping ${prettyId}...`)
      await this.dockerode.getContainer(id).kill()
      console.log(`Stopped ${prettyId}`)
    } else {
      console.warn(`Container already stopped: ${prettyId}`)
    }
    return this
  }

  async wait () {
    if (!this.container) throw new Error.NoContainer()
    const {Error: error, StatusCode: code} = await this.container.wait()
    return { error, code }
  }

  /** Detect when service is ready. */
  async waitLog (
    expected:    string,
    logFilter?:  (data: string) => boolean,
    thenDetach?: boolean,
  ): Promise<void> {
    if (!this.container) {
      throw new Error.NoContainer()
    }
    const id = this.container.id.slice(0,8)
    const stream = await this.container.logs({ stdout: true, stderr: true, follow: true, })
    if (!stream) {
      throw new Error('no stream returned from container')
    }
    const filter = logFilter || (x=>true)
    const logFiltered = (data:string) => {
      if (filter(data)) {
        this.log.debug(data)
      }
    }
    return await waitStream(
      stream as any, expected, thenDetach, logFiltered, this.log
    )
  }

  /** Executes a command in the container.
    * @returns [stdout, stderr] */
  async exec (...command: string[]): Promise<[string, string]> {

    if (!this.container) throw new Error.NoContainer()

    // Specify the execution
    const exec = await this.container.exec({
      Cmd: command,
      AttachStdin:  true,
      AttachStdout: true,
      AttachStderr: true,
    })

    // Collect stdout
    let stdout = ''; const stdoutStream = new Transform({
      transform (chunk, encoding, callback) { stdout += chunk; callback() }
    })

    // Collect stderr
    let stderr = ''; const stderrStream = new Transform({
      transform (chunk, encoding, callback) { stderr += chunk; callback() }
    })

    return new Promise(async (resolve, reject)=>{

      // Start the executon
      const stream = await exec.start({hijack: true})

      // Bind this promise to the stream
      stream.on('error', error => reject(error))
      stream.on('end', () => resolve([stdout, stderr]))

      // Demux the stdout/stderr stream into the two output streams
      this.dockerode.modem.demuxStream(stream, stdoutStream, stderrStream)

    })

  }

  async export (repository?: string, tag?: string) {
    if (!this.container) throw new Error.NoContainer()
    const { Id } = await this.container.commit({ repository, tag })
    this.log.log(`Exported snapshot:`, bold(Id))
    return Id
  }

}

/** Follow the output stream from a Dockerode container until it closes. */
export async function follow (
  dockerode: DockerHandle,
  stream:    any,
  callback:  (data: any)=>void
) {
  await new Promise<void>((ok, fail)=>{
    dockerode.modem.followProgress(stream, complete, callback)
    function complete (err: any, _output: any) {
      if (err) return fail(err)
      ok()
    }
  })
}

/* Is this equivalent to follow() and, if so, which implementation to keep? */
export function waitStream (
  stream:     { on: Function, off: Function, destroy: Function },
  expected:   string,
  thenDetach: boolean = true,
  trail:      (data: string) => unknown = ()=>{},
  { log }:    Console = console
): Promise<void> {
  return new Promise((resolve, reject)=>{
    stream.on('error', (error: any) => {
      reject(error)
      stream.off('data', waitStream_onData)
    })
    stream.on('data', waitStream_onData)
    function waitStream_onData (data: any) {
      const dataStr = String(data).trim()
      if (trail) trail(dataStr)
      if (dataStr.indexOf(expected)>-1) {
        log(`Found expected message:`, bold(expected))
        stream.off('data', waitStream_onData)
        if (thenDetach) stream.destroy()
        resolve()
      }
    }
  })
}

/** A stub implementation of the Dockerode APIs used by @fadroma/oci. */
export function mockDockerode (callback: Function = () => {}): DockerHandle {
  return {
    getImage () {
      return { async inspect () { return } }
    },
    getContainer (options: any) {
      return mockDockerodeContainer(callback)
    },
    async pull (name: any, callback: any) {
      callback(null, null)
    },
    buildImage () {},
    async createContainer (options: any) {
      return mockDockerodeContainer(callback)
    },
    async run (...args: any) {
      callback({run:args})
      return [{Error:null,StatusCode:0},Symbol()]
    },
    modem: {
      followProgress (stream: any, complete: Function, callback: any) { complete(null, null) }
    }
  }
}

export function mockDockerodeContainer (callback: Function = () => {}) {
  return {
    id: 'mockmockmock',
    logs (options: any, cb: Function) {
      cb(...(callback({ createContainer: options })||[null, mockStream()]))
    },
    async start   () {},
    async attach  () { return {setEncoding(){},pipe(){}} },
    async wait    () { return {Error:null,StatusCode:0}  },
    async inspect () {
      return {
        Image:' ',
        Name:null,
        Args:null,
        Path:null,
        State:{Running:null},
        NetworkSettings:{IPAddress:null}
      }
    }
  }
}

export function mockStream () {
  return { on: () => {} }
}

export {
  DockerEngine    as Engine,
  DockerImage     as Image,
  DockerContainer as Container
}
