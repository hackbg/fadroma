import { Docker } from 'dockerode'
import Console from '@hackbg/konzola'
import colors from 'colors'

const console = Console('@hackbg/tools/logs')
const { bold } = colors
const RE_GARBAGE = /[\x00-\x1F]/
const logsOptions = {
  stdout: true,
  stderr: true,
  follow: true,
  tail:   100
}

/** Represents a docker image for builder or devnet,
  * and can ensure its presence by pulling or building. */
export class DockerImage {
  constructor (
    public docker     = new Docker({ socketPath: '/var/run/docker.sock' }),
    public name       = null,
    public dockerfile = null,
    public extraFiles = []
  ) {}

  #available = null

  async ensure () {
    if (this.#available) {
      console.info(bold('Already ensuring build image from parallel build:'), this.name)
      return await this.#available
    } else {
      console.info(bold('Ensuring build image:'), this.name)
      console.info(bold('Using dockerfile:'), this.dockerfile)
      return await (this.#available = new Promise(async(resolve, reject)=>{
        const {docker, name, dockerfile, extraFiles} = this
        const PULLING  = `Image ${name} not found, pulling...`
        const BUILDING = `Image ${name} not found upstream, building from ${dockerfile}...`
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
  async build () {
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

  protected async follow (stream, callback) {
    await new Promise((ok, fail)=>{
      this.docker.modem.followProgress(stream, complete, callback)
      function complete (err: Error, _output: unknown) {
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

    container.logs(logsOptions, onStream)

    function onStream (err, stream) {
      if (err) return fail(err)

      console.info('Trailing logs...')
      stream.on('data', onData)

      function onData (data) {
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
      }
    }

  })
}

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
