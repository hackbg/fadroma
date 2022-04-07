import LineTransformStream from 'line-transform-stream'

import {
  Console, bold, basename, dirname, relative, resolve, cwd, freePort,
  Directory, JSONDirectory, waitPort, waitUntilLogsSay
} from '@hackbg/tools'

import { Source, codeHashForPath } from './Core'
import { config } from './Config'
import { Devnet, DevnetOptions } from './Devnet'
import { CachingBuilder } from './Build'

const console = Console('@fadroma/ops/Docker')

import Docker from 'dockerode'
export { Docker }

/** Represents a docker image for builder or devnet,
  * and can ensure its presence by pulling or building. */
export class DockerImage {
  constructor (
    public readonly docker:     Docker = new Docker({ socketPath: '/var/run/docker.sock' }),
    public readonly name:       string|null = null,
    public readonly dockerfile: string|null = null,
    public readonly extraFiles: string[]    = []
  ) {}

  #available: Promise<string>|null = null

  get available () {
    if (!this.#available) {
      console.info(bold('Ensuring build image:'), this.name)
      console.info(bold('Using dockerfile:'), this.dockerfile)
      // ban of async getters detaches the event loop
      return this.#available = this.ensure()
    } else {
      console.info(bold('Already ensuring build image from parallel build:'), this.name)
      return this.#available
    }
  }

  async ensure () {
    const {docker, name, dockerfile, extraFiles} = this
    const PULLING  = `Image ${name} not found, pulling...`
    const BUILDING = `Image ${name} not found upstream, building from ${dockerfile}...`
    const NO_FILE  = `Image ${name} not found and no Dockerfile provided; can't proceed.`
    try {
      await this.check()
    } catch (_e) {
      try {
        console.warn(PULLING)
        await this.pull()
      } catch (e) {
        if (!dockerfile) {
          throw new Error(`${NO_FILE} (${e.message})`)
        } else {
          console.warn(BUILDING)
          await this.build()
        }
      }
    }
    return name
  }

  /** Throws if inspected image does not exist locally. */
  async check (): Promise<void> {
    await this.docker.getImage(this.name).inspect()
  }

  /** Throws if inspected image does not exist in Docker Hub. */
  async pull (): Promise<void> {
    const { name, docker, dockerfile } = this
    await new Promise<void>((ok, fail)=>{
      docker.pull(name, callback)
      async function callback (err: Error, stream: unknown) {
        if (err) return fail(err)
        await this.follow(stream, (event: Record<string, unknown>) => {
          if (event.error) {
            console.error(event.error)
            throw new Error(`Pulling ${name} failed.`)
          }
          console.info(
            `📦 docker pull says:`,
            ['id', 'status', 'progress'].map(x=>event[x]).join('│')
          )
        })
      }
    })
  }

  /* Throws if the build fails, and then you have to fix stuff. */
  async build (): Promise<void> {
    const { name, docker } = this
    const dockerfile = basename(this.dockerfile)
    const context    = dirname(this.dockerfile)
    const src        = [dockerfile, ...this.extraFiles]
    const stream = await docker.buildImage({ context, src }, { t: this.name, dockerfile })
    await this.follow(stream, (event: Record<string, unknown>) => {
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

  protected async follow (stream, callback): Promise<void> {
    await new Promise<void>((ok, fail)=>{
      this.docker.modem.followProgress(stream, complete, callback)
      function complete (err: Error, _output: unknown) {
        if (err) return fail(err)
        ok()
      }
    })
  }
}
