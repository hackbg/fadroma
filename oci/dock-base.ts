import { hideProperties as hide } from '@hackbg/hide'
import { DockError as Error, DockConsole as Console, bold } from './dock-events'
import type { LineTransformStream } from './dock-logs'
import type { Writable } from 'node:stream'

export abstract class Engine {

  constructor (options: string|{
    name: string
    log?: Console
  }) {
    if (typeof options === 'string') {
      options = { name: options }
    }
    this.name = options.name
    this.log  = options.log ?? new Console(`@fadroma/oci: ${this.name}`)
    hide(this, 'log')
  }

  readonly name:
    string

  log:
    Console

  abstract image (name: string|null, dockerfile?: string|null, extraFiles?: string[]):
    Image

  abstract container (id: string):
    Promise<Container>

  static Image:
    typeof Image

  static Container:
    typeof Container

  static LineTransformStream:
    typeof LineTransformStream

}

export abstract class Image {

  constructor (
    readonly engine:     Engine|null,
    readonly name:       string|null,
    readonly dockerfile: string|null = null,
    readonly extraFiles: string[]    = []
  ) {
    this.log = new Console(`Image(${bold(this.name)})`)
    hide(this, 'log')
  }

  log:
    Console

  /** Throws if inspected image does not exist locally. */
  abstract check ():
    Promise<void>

  abstract pull ():
    Promise<void>

  abstract build ():
    Promise<void>

  abstract run (
    name?:         string,
    options?:      Partial<ContainerOpts>,
    command?:      ContainerCommand,
    entrypoint?:   ContainerCommand,
    outputStream?: Writable
  ): Promise<Container>

  abstract container (
    name?:       string,
    options?:    Partial<ContainerOpts>,
    command?:    ContainerCommand,
    entrypoint?: ContainerCommand,
  ): Container

  protected _available:
    Promise<this>|null = null

  async ensure (): Promise<this> {
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

  get [Symbol.toStringTag](): string { return this.name||'' }

}

/** Interface to a Docker container. */
export abstract class Container {

  constructor (
    readonly image:       Image,
    readonly name:        string|null = null,
    readonly options:     Partial<ContainerOpts> = {},
    readonly command?:    ContainerCommand,
    readonly entrypoint?: ContainerCommand
  ) {
    this.log = new Console(name ? `Container(${bold(name)})` : `container`)
    hide(this, 'log')
  }

  log:
    Console

  abstract get id ():
    string

  abstract get shortId ():
    string

  abstract get warnings ():
    string[]

  abstract get isRunning ():
    Promise<boolean>

  abstract get ip ():
    Promise<string>

  /** Create a container. */
  abstract create ():
    Promise<this>

  /** Remove a stopped container. */
  abstract remove ():
    Promise<this>

  /** Start a container. */
  abstract start ():
    Promise<this>

  /** Get info about a container. */
  abstract inspect ():
    Promise<ContainerState>

  /** Immediately terminate a running container. */
  abstract kill ():
    Promise<this>

  /** Wait for the container to exit. */
  abstract wait ():
    Promise<{ error?: any, code: number }>

  /** Wait for the container logs to emit an expected string. */
  abstract waitLog (
    expected:    string,
    logFilter?:  (data: string) => boolean,
    thenDetach?: boolean,
  ): Promise<void>

  /** Execute a command in an existing container. */
  abstract exec (...command: string[]):
    Promise<[string, string]>

  /** Save a container as an image. */
  abstract export (repository?: string, tag?: string):
    Promise<string>

  static async create (
    image:       Image,
    name?:       string,
    options?:    Partial<ContainerOpts>,
    command?:    ContainerCommand,
    entrypoint?: ContainerCommand,
  ) {
    await image.ensure()
    const self = new (this as any)(image, name, options, command, entrypoint)
    await self.create()
    return self
  }

  static async run (
    image:         Image,
    name?:         string,
    options?:      Partial<ContainerOpts>,
    command?:      ContainerCommand,
    entrypoint?:   ContainerCommand,
    outputStream?: Writable
  ) {
    const self = await this.create(image, name, options, command, entrypoint)
    if (outputStream) {
      if (!self.container) throw new Error.NoContainer()
      const stream = await self.container.attach({ stream: true, stdin: true, stdout: true })
      stream.setEncoding('utf8')
      stream.pipe(outputStream, { end: true })
    }
    await self.start()
    return self
  }

  get [Symbol.toStringTag](): string { return this.name||'' }

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
