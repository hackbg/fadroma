import Docker  from 'dockerode'
export { Docker }

import Console from '@hackbg/konzola'
const console = Console('@hackbg/dokeres')

import colors from 'colors'
const { bold } = colors

import { basename, dirname } from 'path'

/** Represents a docker image for builder or devnet,
  * and can ensure its presence by pulling or building. */
export class DockerImage {
  constructor (
    docker     = new Docker({ socketPath: process.env.DOCKER_HOST || '/var/run/docker.sock' }),
    name       = null,
    dockerfile = null,
    extraFiles = []
  ) {
    Object.assign(this, { docker, name, dockerfile, extraFiles })
  }

  #available = null

  async ensure () {
    if (this.#available) {
      console.info(bold('Already ensuring image from parallel build:'), this.name)
      return await this.#available
    } else {
      console.info(bold('Ensuring image:'), this.name)
      return await (this.#available = new Promise(async(resolve, reject)=>{
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
        await this.follow(stream, (event) => {
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
    const stream = await docker.buildImage({ context, src }, { t: this.name, dockerfile })
    await this.follow(stream, (event) => {
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

  async follow (stream, callback) {
    await new Promise((ok, fail)=>{
      this.docker.modem.followProgress(stream, complete, callback)
      function complete (err, _output) {
        if (err) return fail(err)
        ok()
      }
    })
  }
}

/** The caveman solution to detecting when the node is ready to start receiving requests:
  * trail node logs until a certain string is encountered */
export function waitUntilLogsSay (
  container  = { id: null, logs: null },
  expected   = '',
  thenDetach = true
) {
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
          const seconds = 7
          console.info(bold(`Waiting ${seconds} seconds`), `for good measure...`)
          return setTimeout(ok, seconds * 1000)
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
