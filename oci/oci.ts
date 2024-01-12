import { hideProperties as hide } from '@hackbg/hide'
import { Writable, Transform } from 'node:stream'
import { basename, dirname } from 'node:path'
import Docker from 'dockerode'
import {
  assign,
  bold,
  Backend,
  Connection,
  ContractTemplate,
  ContractInstance,
  Console,
} from '@fadroma/agent'
import { OCIError, OCIConsole } from './oci-base'
import type { DockerHandle } from './oci-base'
import * as Mock from './oci-mock'
import { toDockerodeOptions } from './oci-impl'

/** Defaults to the `DOCKER_HOST` environment variable. */
export const defaultSocketPath = process.env.DOCKER_HOST || '/var/run/docker.sock'

export const console = new OCIConsole('@fadroma/oci')

export class OCIConnection extends Connection {
  static mock (callback?: Function) {
    return new this({ api: Mock.mockDockerode(callback) })
  }

  /** By default, creates an instance of Dockerode
    * connected to env `DOCKER_HOST`. You can also pass
    * your own Dockerode instance or socket path. */
  constructor (properties: Partial<OCIConnection> = {}) {
    properties = { ...properties }
    if (!properties.api) {
      properties.api = new Docker({ socketPath: defaultSocketPath })
    } else if (typeof properties.api === 'object') {
      properties.api = properties.api
    } else if (typeof properties.api === 'string') {
      properties.api = new Docker({ socketPath: properties.api })
    } else {
      throw new OCIError('invalid docker engine configuration')
    }
    super(properties as Partial<Connection>)
  }

  declare api: DockerHandle

  async doGetHeight () {
    throw new OCIError('doGetHeight: not applicable')
    return + new Date()
  }
  async doGetBlockInfo () {
    throw new OCIError('doGetBlockInfo: not applicable')
    return {}
  }
  async doGetBalance () {
    throw new OCIError('doGetBalance: not applicable')
    return 0
  }
  async doSend () {
    throw new OCIError('doSend: not applicable')
  }
  async doSendMany () {
    throw new OCIError('doSendMany: not applicable')
  }

  async doGetCodeId (containerId: string): Promise<string> {
    const container = await this.api.getContainer(containerId)
    const info = await container.inspect()
    return info.Image
  }
  async doGetCodeHashOfCodeId (contract) {
    return ''
  }
  async doGetCodeHashOfAddress (contract) {
    return ''
  }
  /** Returns list of container images. */
  async doGetCodes () {
    return (await this.api.listImages())
      .reduce((images, image)=>Object.assign(images, {
        [image.Id]: image
      }), {})
  }
  /** Returns list of containers from a given image. */
  async doGetContractsByCodeId (imageId) {
    return (await this.api.listContainers())
      .filter(container=>container.Image === imageId)
      .map(container=>({ address: container.Id, codeId: imageId, container }))
  }
  async doUpload (data: Uint8Array) {
    throw new OCIError('doUpload (load/import image): not implemented')
    return {}
  }
  async doInstantiate (imageId: string) {
    throw new OCIError('doInstantiate (create container): not implemented')
    return {}
  }
  async doExecute () {
    throw new OCIError('doExecute (exec in container): not implemented')
    return {}
  }
  async doQuery (contract, message) {
    throw new OCIError('doQuery (inspect image): not implamented')
    return {}
  }

  image (
    name:        string|null,
    dockerfile?: string|null,
    extraFiles?: string[]
  ): OCIImage {
    return new OCIImage({ engine: this, name, dockerfile, extraFiles })
  }

  async container (id: string): Promise<OCIContainer> {
    const container = await this.api.getContainer(id)
    const { Image, Name: name, Args: command, Path: entrypoint } = await container.inspect()
    const image = this.image(Image)
    return Object.assign(new OCIContainer({
      image, name, command, entrypoint
    }), { container })
  }
}

export class OCIImage extends ContractTemplate {

  constructor (properties: Partial<OCIImage> = {}) {
    super(properties)
    assign(this, properties, ['name', 'engine', 'dockerfile', 'extraFiles'])
    this.log = new OCIConsole(`Image(${bold(this.name)})`)
    hide(this, 'log')
  }

  declare log: OCIConsole
  engine:      OCIConnection|null
  dockerfile:  string|null = null
  extraFiles:  string[]    = []

  get [Symbol.toStringTag](): string { return this.name||'' }

  protected _available: Promise<this>|null = null

  async pullOrBuild (): Promise<this> {
    this._available ??= new Promise(async(resolve, reject)=>{
      this.log.ensuring()
      try {
        await this.check()
        this.log.imageExists()
      } catch (e1) {
        if (e1.statusCode !== 404) return reject(e1)
        // if image doesn't exist locally, try pulling it
        try {
          this.log.notCachedPulling()
          await this.pull()
        } catch (e2) {
          this.log.error(e2)
          if (!this.dockerfile) {
            const NO_FILE  = `Unavailable and no Dockerfile provided; can't proceed.`
            reject(`${NO_FILE} (${e2.message})`)
          } else {
            this.log.notFoundBuilding(e2.message)
            this.log.buildingFromDockerfile(this.dockerfile)
            await this.build()
          }
        }
      }
      resolve(this)
    })
    return await Promise.resolve(this._available)
  }

  get api (): Docker {
    if (!this.engine || !this.engine.api) {
      throw new OCIError.NoDockerode()
    }
    return this.engine.api as unknown as Docker
  }

  /** Throws if inspected image does not exist locally. */
  async check () {
    if (!this.name) {
      throw new OCIError.NoName('inspect')
    }
    await this.api.getImage(this.name).inspect()
  }

  /** Throws if inspected image does not exist in Docker Hub. */
  async pull () {
    const { name, api } = this
    if (!name) {
      throw new OCIError.NoName('pull')
    }
    await new Promise<void>((ok, fail)=>{
      const log = new OCIConsole(`pulling docker image ${this.name}`)
      api.pull(name, async (err: any, stream: any) => {
        if (err) return fail(err)
        await follow(api, stream, (event) => {
          if (event.error) {
            log.error(event.error)
            throw new OCIError.PullFailed(name)
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
    if (!this.dockerfile) {
      throw new OCIError.NoDockerfile()
    }
    if (!this.engine?.api) {
      throw new OCIError.NoDockerode()
    }
    const { name, engine: { api } } = this
    const dockerfile = basename(this.dockerfile)
    const context = dirname(this.dockerfile)
    const src = [dockerfile, ...this.extraFiles]
    const build = await api.buildImage(
      { context, src },
      { t: this.name, dockerfile }
    )
    const log = new OCIConsole(`building docker image ${this.name}`)
    await follow(api, build, (event) => {
      if (event.error) {
        log.error(event.error)
        throw new OCIError.BuildFailed(name??'(no name)', dockerfile, context)
      }
      const data = event.progress || event.status || event.stream || JSON.stringify(event) || ''
      this.log(data.trim())
    })
  }

  async run (parameters: {
    name?:         string,
    options?:      Partial<ContainerOpts>,
    command?:      ContainerCommand,
    entrypoint?:   ContainerCommand,
    outputStream?: Writable
  } = {}) {
    const { name, options, command, entrypoint, outputStream } = parameters
    await this.pullOrBuild()
    const container = new OCIContainer({ image: this, name, options, command, entrypoint })
    await container.create()
    if (outputStream) {
      const stream = await container.container.attach({
        stream: true, stdin: true, stdout: true
      })
      stream.setEncoding('utf8')
      stream.pipe(outputStream, { end: true })
    }
    await container.start()
    return container
  }

  container (
    name?:       string,
    options?:    Partial<ContainerOpts>,
    command?:    ContainerCommand,
    entrypoint?: ContainerCommand,
  ) {
    return new OCIContainer({
      image: this,
      name,
      options,
      command,
      entrypoint
    })
  }
}

/** Interface to a Docker container. */
export class OCIContainer extends ContractInstance {

  constructor (properties: Partial<OCIContainer> = {}) {
    super(properties)
    assign(this, properties, ['engine', 'image', 'entrypoint', 'command', 'options'])
    this.log = new OCIConsole('OCIContainer')
    hide(this, 'log')
  }

  engine:      OCIConnection|null
  image:       OCIImage
  entrypoint?: ContainerCommand
  command?:    ContainerCommand
  options:     Partial<ContainerOpts> = {}
  declare log: OCIConsole
  container:   Docker.Container|null = null

  get [Symbol.toStringTag](): string { return this.name||'' }

  get api (): Docker {
    return (this.engine||this.image.engine).api as unknown as Docker
  }

  get id (): string {
    if (!this.container) {
      throw new OCIError.NoContainer()
    }
    return this.container.id
  }

  get shortId (): string {
    if (!this.container) {
      throw new OCIError.NoContainer()
    }
    return this.container.id.slice(0, 8)
  }

  get warnings (): string[] {
    if (!this.container) {
      throw new OCIError.NoContainer()
    }
    return (this.container as any).Warnings
  }

  get isRunning (): Promise<boolean> {
    return this.inspect().then(state=>state.State.Running)
  }

  get ip (): Promise<string> {
    return this.inspect().then(state=>state.NetworkSettings.IPAddress)
  }

  get exists (): Promise<boolean> {
    if (this.container) {
      return this.inspect().then(()=>true)
    } else {
      return Promise.resolve(false)
    }
  }

  /** Create a container. */
  async create (): Promise<this> {
    if (this.container) {
      throw new OCIError.ContainerAlreadyCreated()
    }
    // Specify the container
    const opts = toDockerodeOptions(this)
    this.image.log.creatingContainer(opts.name)
    // Log mounted volumes
    this.log.boundVolumes(opts?.HostConfig?.Binds ?? [])
    // Log exposed ports
    for (const [containerPort, config] of Object.entries(opts?.HostConfig?.PortBindings ?? {})) {
      for (const { HostPort = '(unknown)' } of config as Array<{HostPort: unknown}>) {
        this.log.boundPort(containerPort, HostPort)
      }
    }
    // Make sure the image exists
    await this.image.pullOrBuild()
    // Create the container
    this.container = await this.api.createContainer(opts)
    // Update the logger tag with the container id
    this.log.label = this.name
      ? `OCIContainer(${this.container.id} ${this.name})`
      : `OCIContainer(${this.container.id})`
    // Display any warnings emitted during container creation
    if (this.warnings) {
      this.log.createdWithWarnings(this.shortId, this.warnings)
    }
    return this
  }

  /** Remove a stopped container. */
  async remove (): Promise<this> {
    if (this.container) await this.container.remove()
    this.container = null
    return this
  }

  /** Start a container. */
  async start (): Promise<this> {
    if (!this.container) await this.create()
    await this.container!.start()
    return this
  }

  /** Get info about a container. */
  inspect () {
    if (!this.container) {
      throw new OCIError.NoContainer()
    }
    return this.container.inspect()
  }

  /** Immediately terminate a running container. */
  async kill (): Promise<this> {
    if (!this.container) {
      throw new OCIError.NoContainer()
    }
    const id = this.shortId
    const prettyId = bold(id.slice(0,8))
    if (await this.isRunning) {
      this.log(`Stopping ${prettyId}...`)
      await this.api.getContainer(id).kill()
      this.log(`Stopped ${prettyId}`)
    } else {
      this.log.warn(`Container already stopped: ${prettyId}`)
    }
    return this
  }

  /** Wait for the container to exit. */
  async wait () {
    if (!this.container) {
      throw new OCIError.NoContainer()
    }
    const {Error: error, StatusCode: code} = await this.container.wait()
    return { error, code }
  }

  /** Wait for the container logs to emit an expected string. */
  async waitLog (
    expected:    string,
    logFilter?:  (data: string) => boolean,
    thenDetach?: boolean,
  ): Promise<void> {
    if (!this.container) {
      throw new OCIError.NoContainer()
    }
    const id = this.container.id.slice(0,8)
    const stream = await this.container.logs({
      stdout: true, stderr: true, follow: true
    })
    if (!stream) {
      throw new OCIError('no stream returned from container')
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
    if (!this.container) {
      throw new OCIError.NoContainer()
    }
    // Specify the execution
    const exec = await this.container.exec({
      Cmd: command, AttachStdin: true, AttachStdout: true, AttachStderr: true,
    })
    // Collect stdout
    let stdout = ''
    const stdoutStream = new Transform({
      transform (chunk, encoding, callback) { stdout += chunk; callback() }
    })
    // Collect stderr
    let stderr = ''
    const stderrStream = new Transform({
      transform (chunk, encoding, callback) { stderr += chunk; callback() }
    })
    return new Promise(async (resolve, reject)=>{
      // Start the executon
      const stream = await exec.start({hijack: true})
      // Bind this promise to the stream
      stream.on('error', error => reject(error))
      stream.on('end', () => resolve([stdout, stderr]))
      // Demux the stdout/stderr stream into the two output streams
      this.api.modem.demuxStream(stream, stdoutStream, stderrStream)
    })
  }

  /** Save a container as an image. */
  async export (repository?: string, tag?: string) {
    if (!this.container) {
      throw new OCIError.NoContainer()
    }
    const { Id } = await this.container.commit({ repository, tag })
    this.log.log(`Exported snapshot:`, bold(Id))
    return Id
  }

}

export interface ContainerOpts {
  cwd:      string
  env:      Record<string, string>
  exposed:  string[]
  mapped:   Record<string, string>
  readonly: Record<string, string>
  writable: Record<string, string>
  extra:    Record<string, unknown>
  remove:   boolean
}

export type ContainerCommand = string|string[]

export interface ContainerState {
  Image: string,
  State: { Running: boolean },
  NetworkSettings: { IPAddress: string }
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

/** Based on: Line Transform Stream by Nick Schwarzenberg <nick@bitfasching.de>
  * https://github.com/bitfasching/node-line-transform-stream#readme
  * Used under MIT license. */
export class LineTransformStream extends Transform {
  declare transformCallback: Function
  declare stringEncoding:    string
  declare lineBuffer:        string
  constructor (transformCallback: Function, stringEncoding: string = 'utf8') {
    // fail if callback is not a function
    if (typeof transformCallback != 'function') throw new TypeError("Callback must be a function.")
    // initialize parent
    super()
    // set callback for transforming lines
    this.transformCallback = transformCallback
    // set string encoding
    this.stringEncoding = stringEncoding
    // initialize internal line buffer
    this.lineBuffer = ''
  }
  // implement transform method (input encoding is ignored)
  _transform(data: any, encoding: string, callback: Function) {
    // convert data to string
    data = data.toString(this.stringEncoding)
    // split data at line breaks
    const lines = data.split( '\n' )
    // prepend buffered data to first line
    lines[0] = this.lineBuffer + lines[0]
    // last "line" is actually not a complete line,
    // remove it and store it for next time
    this.lineBuffer = lines.pop()
    // collect output
    let output = ''
    // process line by line
    lines.forEach((line: string) => {
      try {
        // pass line to callback, transform it and add line-break back
        output += this.transformCallback( line ) + '\n'
      } catch (error) {
        // catch processing errors and emit as stream error
        callback(error)
      }
    })
    // push output
    callback(null, output)
  }
}
