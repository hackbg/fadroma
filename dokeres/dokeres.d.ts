declare module '@hackbg/dokeres' {

  export class Dockerode {
    constructor (object)
    run?: Function
    getImage (): {
      inspect (): Promise<any>
    }
    pull (image: any, callback: Function): void
    modem: {
      followProgress (
        stream:   any,
        callback: Function,
        progress: Function
      ): any
    }
    getContainer (id: any): {
      id: string,
      start (): Promise<any>
    }
    createContainer (options: any): {
      id: string
      logs (_: any, callback: Function): void
    }
  }

  export class DockerodeContainer {
    readonly id: string
    Warnings:    string[]
    inspect:     Promise<void>
    start:       Promise<void>
    kill:        Promise<void>
  }

  export function follow (docker: Dockerode, stream: unknown, callback: Function): Promise<void>

  export const socketPath: string

  /** Wrapper around Dockerode.
    * Used to optain `DokeresImage` instances. */
  export class Dokeres {
    /** By default, creates an instance of Dockerode
      * connected to env `DOCKER_HOST`. You can also pass
      * your own Dockerode instance or socket path. */
    constructor (dockerode: Dockerode|string)
    readonly dockerode: Dockerode
    image (
      name:        string|null,
      dockerfile:  string|null,
      extraFiles?: string[]
    ): DokeresImage
  }

  /** Interface to a Docker image. */
  export class DokeresImage {
    name: string
    constructor (
      dokeres:     Dokeres,
      name:        string|null,
      dockerfile:  string|null,
      extraFiles?: string[]
    )

    ensure (): Promise<void>
    check  (): Promise<void>
    pull   (): Promise<void>
    build  (): Promise<void>

    run (
      name?:       string,
      options?:    DokeresConfig,
      command?:    DokeresCommand,
      entrypoint?: DokeresCommand
    ): Promise<DokeresContainer>
  }

  export type DokeresConfig = object // TODO

  export type DokeresCommand = string|string[]

  /** Interface to a Docker container. */
  export class DokeresContainer {
    static run (
      image:       DokeresImage,
      name?:       string,
      options?:    DokeresConfig,
      command?:    DokeresCommand,
      entrypoint?: DokeresCommand
    ): Promise<DokeresContainer>

    constructor (
      image:     DokeresImage,
      config:    DokeresConfig,
      container: DockerodeContainer
    )

    readonly docker:    Dockerode
    readonly image:     DokeresImage
    readonly config:    DokeresConfig
    readonly container: DokeresContainer

    get id ():        string
    get shortId ():   string
    create ():        Promise<this>
    get warnings ():  string[]
    start ():         Promise<this>
    get isRunning (): Promise<boolean>
    kill ():          Promise<this>

  }

  export function waitUntilLogsSay (container: any, expected: any, thenDetach: any): any

}
