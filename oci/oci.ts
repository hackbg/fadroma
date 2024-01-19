import { hideProperties as hide } from '@hackbg/hide'
import { Writable, Transform } from 'node:stream'
import { basename, dirname } from 'node:path'
import Docker from 'dockerode'
import { Core, Chain, Deploy } from '@fadroma/agent'
import { OCIError as Error, OCIConsole as Console, assign, bold } from './oci-base'
import type { DockerHandle } from './oci-base'
import * as Mock from './oci-mock'
import { toDockerodeOptions, waitStream } from './oci-impl'

const { colors, randomColor } = Core

export { Mock }

/** Defaults to the `DOCKER_HOST` environment variable. */
export const defaultSocketPath = process.env.DOCKER_HOST || '/var/run/docker.sock'

export const console = new Console('@fadroma/oci')

class OCIConnection extends Chain.Connection {
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
      throw new Error('invalid docker engine configuration')
    }
    super(properties as Partial<Chain.Connection>)
  }

  declare api: DockerHandle

  async doGetHeight () {
    throw new Error('doGetHeight: not applicable')
    return + new Date()
  }
  async doGetBlockInfo () {
    throw new Error('doGetBlockInfo: not applicable')
    return {}
  }
  async doGetBalance () {
    throw new Error('doGetBalance: not applicable')
    return 0
  }
  async doSend () {
    throw new Error('doSend: not applicable')
  }
  async doSendMany () {
    throw new Error('doSendMany: not applicable')
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
    throw new Error('doUpload (load/import image): not implemented')
    return {}
  }
  async doInstantiate (imageId: string) {
    throw new Error('doInstantiate (create container): not implemented')
    return {}
  }
  async doExecute () {
    throw new Error('doExecute (exec in container): not implemented')
    return {}
  }
  async doQuery (contract, message) {
    throw new Error('doQuery (inspect image): not implamented')
    return {}
  }

  image (
    name:        string|null,
    dockerfile?: string|null,
    inputFiles?: string[]
  ): OCIImage {
    return new OCIImage({ engine: this, name, dockerfile, inputFiles })
  }

  container (id: string): OCIContainer {
    return new OCIContainer({ engine: this, id })
  }
}

class OCIImage extends Deploy.ContractTemplate {

  constructor (properties: Partial<OCIImage> = {}) {
    super(properties)
    assign(this, properties, ['name', 'engine', 'dockerfile', 'inputFiles'])
    this.log = new Console(this.name || '(container image)')
    hide(this, 'log')
  }

  declare log: Console
  engine:      OCIConnection|null
  dockerfile:  string|null = null
  inputFiles:  string[]    = []

  get [Symbol.toStringTag](): string { return this.name||'' }

  protected _available: Promise<this>|null = null

  get api () {
    if (!this.engine || !this.engine.api) {
      throw new Error.NoDockerode()
    }
    return this.engine.api.getImage(this.name)
  }

  container (
    name?:       string,
    options?:    Partial<ContainerOpts>,
    command?:    ContainerCommand,
    entrypoint?: ContainerCommand,
  ) {
    return new OCIContainer({
      image: this,
      engine: this.engine,
      name,
      options,
      command,
      entrypoint
    })
  }

  /** Get info about a container. */
  async inspect () {
    return await this.api.inspect()
  }

  /** Check if the image exists. */
  async exists (): Promise<boolean> {
    try {
      await this.inspect()
      return true
    } catch (e) {
      if (e.statusCode === 404) {
        return false
      } else {
        throw e
      }
    }
  }

  /** Throws if inspected image does not exist locally. */
  async assertExists () {
    if (!this.name) {
      throw new Error.NoName('inspect')
    }
    await this.api.inspect()
  }

  /** Remove this image. */
  async remove () {
    return this.api.remove()
  }

  /** Pull the image from the registry, or build it from a local file if not available there. */
  async pullOrBuild (): Promise<this> {
    this._available ??= new Promise(async(resolve, reject)=>{
      this.log.ensuring()
      try {
        await this.assertExists()
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

  /** Throws if inspected image does not exist in Docker Hub. */
  async pull () {
    const { name, engine: { api } } = this
    if (!name) {
      throw new Error.NoName('pull')
    }
    const seed = this.name
    const tagColor = randomColor({ luminosity: 'dark', seed })
    this.log.label = colors.bgHex(tagColor).whiteBright(` ${seed} `)
    const log = this.log
    await new Promise<void>((ok, fail)=>{
      api.pull(name, async (err: any, stream: any) => {
        if (err) return fail(err)
        await follow(api, stream, (event) => {
          if (event.error) {
            log.error(event.error)
            throw new Error.PullFailed(name)
          }
          const data = ['id', 'status', 'progress'].map(x=>event[x]).join(' ')
          log.log(data)
        })
        ok()
      })
    })
  }

  /* Throws if the build fails, and then you have to fix stuff. */
  async build () {
    if (!this.dockerfile) {
      throw new Error.NoDockerfile()
    }
    if (!this.engine?.api) {
      throw new Error.NoDockerode()
    }
    const { name, engine: { api } } = this
    const seed = name || this.dockerfile
    const tagColor = randomColor({ luminosity: 'dark', seed })
    this.log.label = colors.bgHex(tagColor).whiteBright(` ${seed} `)
    const dockerfile = basename(this.dockerfile)
    const context = dirname(this.dockerfile)
    const src = [dockerfile, ...this.inputFiles||[]]
    const build = await api.buildImage(
      { context, src },
      { t: this.name, dockerfile }
    )
    const log = this.log
    await follow(api, build, (event) => {
      if (event.error) {
        log.error(event.error)
        throw new Error.BuildFailed(name??'(no name)', dockerfile, context)
      }
      const data = event.progress || event.status || event.stream || JSON.stringify(event) || ''
      this.log(data.trim())
    })
  }

  /** Run a container from this image. */
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
      const stream = await (await container.api).attach({
        stream: true, stdin: true, stdout: true
      })
      stream.setEncoding('utf8')
      stream.pipe(outputStream, { end: true })
    }
    await container.start()
    return container
  }

}

/** Interface to a Docker container. */
class OCIContainer extends Deploy.ContractInstance {

  constructor (properties: Partial<OCIContainer> = {}) {
    super(properties)
    assign(this, properties, ['id', 'engine', 'image', 'entrypoint', 'command', 'options'])
    this.log = new Console('OCIContainer')
    hide(this, 'log')
  }

  id?:         string
  engine:      OCIConnection|null
  image:       OCIImage
  entrypoint?: ContainerCommand
  command?:    ContainerCommand
  options:     Partial<ContainerOpts> = {}
  declare log: Console

  get [Symbol.toStringTag](): string { return this.name||'' }

  get api (): Docker.Container {
    return this.engine.api.getContainer(this.id)
  }

  get shortId (): string {
    return this.id.slice(0, 8)
  }

  /** Get info about a container. */
  inspect () {
    return this.api.inspect()
  }

  ip (): Promise<string> {
    return this.inspect().then(state=>{
      return state.NetworkSettings.IPAddress
    })
  }

  exists (): Promise<boolean> {
    return this.inspect().then(()=>true, e=>{
      if (e.statusCode === 404) return false
      throw e
    })
  }

  /** Create a container. */
  async create (): Promise<this> {
    if (!await this.exists()) {
      // Specify the container
      const opts = toDockerodeOptions(this)
      this.image.log.creatingContainer(opts.name)
      // Log mounted volumes
      //this.log.boundVolumes(opts?.HostConfig?.Binds ?? [])
      // Log exposed ports
      for (const [containerPort, config] of Object.entries(opts?.HostConfig?.PortBindings ?? {})) {
        for (const { HostPort = '(unknown)' } of config as Array<{HostPort: unknown}>) {
          //this.log.boundPort(containerPort, HostPort)
        }
      }
      // Make sure the image exists
      await this.image.pullOrBuild()
      // Create the container
      const container = await this.engine.api.createContainer(opts)
      this.id = container.id
      // Update the logger tag with the container id
      const idColor = randomColor({ luminosity: 'dark', seed: this.id })
      let idTag = ''
      idTag += colors.bgHex(idColor).whiteBright(` ${this.shortId} `)
      if (this.name) {
        const tagColor = randomColor({ luminosity: 'dark', seed: this.name })
        idTag += colors.bgHex(tagColor).whiteBright(` ${this.name} `)
      } else {
        idTag += colors.bgHex(idColor).whiteBright(` `)
      }
      this.log.label = `${idTag}`
    }
    return this
  }

  /** Remove a stopped container. */
  async remove (): Promise<this> {
    const api = await this.api
    await api.remove()
    await api.wait({ condition: 'removed' })
    return this
  }

  /** Is this container running? */
  async isRunning (): Promise<boolean> {
    const { State: { Running } } = await this.inspect()
    return Running
  }

  /** Start the container. */
  async start (): Promise<this> {
    const api = await this.api
    if (!await this.exists()) {
      await this.create()
    }
    try {
      await api.start()
    } catch (e) {
      if (e.statusCode !== 304) {
        throw e
      }
    }
    return this
  }

  /** Immediately terminate the container. */
  async kill (): Promise<this> {
    const api = await this.api
    const id = this.shortId
    const prettyId = bold(id.slice(0,8))
    if (await this.isRunning()) {
      this.log(`Stopping ${prettyId}...`)
      await api.kill()
      await api.wait({ condition: 'not-running' })
      this.log(`Stopped ${prettyId}`)
    }
    return this
  }

  /** Wait for the container to exit. */
  async wait () {
    this.log(`Waiting for exit...`)
    const {Error: error, StatusCode: code} = await (await this.api).wait()
    return { error, code }
  }

  /** Wait for the container logs to emit an expected string. */
  async waitLog (
    expected:    string,
    logFilter?:  (data: string) => boolean,
    thenDetach?: boolean,
  ): Promise<void> {
    const stream = await (await this.api).logs({
      stdout: true, stderr: true, follow: true
    })
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
      stream,
      expected,
      thenDetach,
      logFiltered, 
      this.log
    )
  }

  /** Executes a command in the container.
    * @returns [stdout, stderr] */
  async exec (...command: string[]): Promise<[string, string]> {
    // Specify the execution
    const exec = await (await this.api).exec({
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
  async export (repository?: string, tag: string = 'latest') {
    const { Id } = await (await this.api).commit({ repository, tag })
    if (repository && tag) {
      this.log.log(`Exported snapshot:`, bold(`${repository}:${tag}`))
    } else {
      this.log.log(`Exported snapshot:`, bold(Id))
    }
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

export {
  OCIConnection as Connection,
  OCIImage      as Image,
  OCIContainer  as Container,
}
