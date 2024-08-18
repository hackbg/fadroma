import { hideProperties as hide } from '@hackbg/hide'
import { Writable, Transform } from 'node:stream'
import { basename, dirname } from 'node:path'
import Docker from 'dockerode'
import {
  assign, bold, colors, randomColor, Chain, Connection, Agent, SigningConnection, Contract,
  UploadedCode
} from '@hackbg/fadroma'
import { Error, Console } from './oci-base'
import type { DockerHandle } from './oci-base'
import * as Mock from './oci-mock'
import { toDockerodeOptions, waitStream, defaultSocketPath } from './oci-impl'
import { OCIImage, OCIContainer } from './oci-program'

export { Mock, Error, Console }

export const console = new Console('@fadroma/oci')

export class OCI extends Chain {

  static mock (callback?: Function) {
    return new this({
      chainId: 'mock',
      api: Mock.mockDockerode(callback)
    })
  }

  constructor (properties: ConstructorParameters<typeof Chain>[0] & {
    api?: string|DockerHandle
  }) {
    properties ??= {} as any
    super(properties)
    this.#connection = new OCIConnection({
      chain: this,
      api: properties.api
    })
  }

  #connection: OCIConnection
  getConnection (): OCIConnection {
    return this.#connection
  }
  async authenticate (): Promise<OCIAgent> {
    return new OCIAgent({
      chain: this
    })
  }

  image (
    name:        string|null,
    dockerfile?: string|null,
    inputFiles?: string[]
  ): OCIImage {
    return new OCIImage({
      engine: this.getConnection(),
      name,
      dockerfile,
      inputFiles
    })
  }

  container (id: string): OCIContainer {
    return new OCIContainer({
      engine: this.getConnection(),
      id
    })
  }
}

export class OCIConnection extends Connection {

  /** By default, creates an instance of Dockerode
    * connected to env `DOCKER_HOST`. You can also pass
    * your own Dockerode instance or socket path. */
  constructor (
    properties: ConstructorParameters<typeof Connection>[0] & { api?: string|DockerHandle }
  ) {
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
    super(properties)
    this.api = properties.api
  }

  api: DockerHandle

  override async fetchHeightImpl (): Promise<never> {
    throw new Error('fetchHeightImpl: not applicable')
  }

  override async fetchBlockImpl (): Promise<never> {
    throw new Error('fetchBlockImpl: not applicable')
  }

  override async fetchBalanceImpl (): Promise<never> {
    throw new Error('fetchBalanceImpl: not applicable')
  }

  override async fetchContractInfoImpl ({ contracts }): Promise<Record<string, OCIContainer>> {
    const container = await this.api.getContainer(containerId)
    const info = await container.inspect()
    return info.Image
  }

  /** Returns list of container images. */
  override async fetchCodeInfoImpl () {
    return (await this.api.listImages())
      .reduce((images, image)=>Object.assign(images, {
        [image.Id]: image
      }), {})
  }

  /** Returns list of containers from a given image. */
  override async fetchCodeInstancesImpl (
    { codeIds, parallel }: Parameters<Connection["fetchCodeInstancesImpl"]>[0]
  ): Promise<Record<string, Record<string, any>>> {
    const images = Object.keys(codeIds || {})
    const containers = await this.api.listContainers()
    const result: Record<string, Record<string, any>> = {}
    for (const container of containers) {
      if (images.length === 0 || images.includes(container.Image)) {
        result[container.Image] ??= {}
        result[container.Image][container.Id] = new OCIContainer(container)
      }
    }
    return result
  }

  override async queryImpl <T> ({ address, message }: never): Promise<never> {
    throw new Error('doQuery (inspect image): not implemented')
  }
}

export class OCIAgent extends Agent {
  constructor (properties: ConstructorParameters<typeof Agent>[0] & {
    connection: OCISigningConnection
  }) {
    super(properties)
    this.#connection = properties.connection || new OCISigningConnection({
      chain:    this.chain,
      identity: properties.identity,
      api:      this.chain.getConnection().api
    })
  }
  declare chain: OCI
  #connection: OCISigningConnection
  getConnection (): OCISigningConnection {
    return this.#connection
  }
  batch (): never {
    throw new Error('Batching is not available on Docker')
  }
}

export class OCISigningConnection extends SigningConnection {

  /** By default, creates an instance of Dockerode
    * connected to env `DOCKER_HOST`. You can also pass
    * your own Dockerode instance or socket path. */
  constructor (
    properties: ConstructorParameters<typeof SigningConnection>[0] & { api?: string|DockerHandle }
  ) {
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
    super(properties)
  }

  override async sendImpl (_: never): Promise<never> {
    throw new Error('send: not applicable')
  }

  override async uploadImpl (_: never): Promise<never> {
    throw new Error('upload (load/import image): not implemented')
  }

  override async instantiateImpl (_: never): Promise<never> {
    throw new Error('instantiate (create container): not implemented')
  }

  override async executeImpl <T> (_: never): Promise<never> {
    throw new Error('execute (run in container): not implemented')
  }
}
