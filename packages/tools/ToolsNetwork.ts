import { basename, dirname } from 'path'
import { bold, Console } from './ToolsCLI'

const console = Console(import.meta.url)

import { createServer } from 'net'

import waitPort from 'wait-port'
export { waitPort }

/** Get a random free port number by briefly running a server on a random unused port,
  * then stopping the server and returning the port number. */
export function freePort () {
  return new Promise((ok, fail)=>{
    let port = 0
    const server = createServer()
    server.on('listening', () => {
      port = (server.address() as { port: number }).port
      server.close()
    })
    server.on('close', () => ok(port))
    server.on('error', fail)
    server.listen(0, '127.0.0.1')
  })
}

import Docker from 'dockerode';
export { Docker }

/** Make sure an image is present in the Docker cache,
  * by pulling it if `docker.getImage` throws,
  * or by building it if `docker.pull` throws. */
export async function ensureDockerImage (
  imageName:      string,
  dockerfilePath: string,
  docker = new Docker()
): Promise<string> {

  try {
    await checkImage()
  } catch (_e) {
    try {
      console.warn(`Image ${imageName} not found, pulling...`)
      await pullImage()
    } catch (_e) {
      console.warn(`Image ${imageName} not found upstream, building...`)
      await buildImage()
    }
  }

  return imageName // return just the name

  /** Throws if inspected image does not exist locally. */
  async function checkImage (): Promise<void> {
    const image = docker.getImage(imageName)
    await image.inspect()
  }

  /** Throws if inspected image does not exist in Docker Hub. */
  async function pullImage (): Promise<void> {
    await new Promise<void>((ok, fail)=>docker.pull(
      imageName,
      (err: Error, stream: unknown) => {
        if (err) return fail(err)
        docker.modem.followProgress(
          stream,
          (err: Error, _output: unknown) => {
            if (err) return fail(err)
            console.info(`pull ok`)
            ok()
          },
          (event: Record<string, unknown>) => console.info(
            `📦 docker pull says:`,
            ['id', 'status', 'progress'].map(x=>event[x]).join('│')
          )
        )
      }
    ))
  }

  /* Throws if the build fails, and then you have to fix stuff. */
  async function buildImage (): Promise<void> {
    const context = dirname(dockerfilePath)
    const src     = [basename(dockerfilePath)]
    const stream = await docker.buildImage({ context, src }, { t: imageName })
    await new Promise<void>((ok, fail)=>docker.modem.followProgress(
      stream,
      (err: Error, _output: unknown) => {
        if (err) return fail(err)
        console.info(`build ok`)
        ok()
      },
      (event: Record<string, unknown>) => console.info(
        `📦 docker build says:`,
        JSON.stringify(event)
      )
    ))
  }

}

const RE_GARBAGE = /[\x00-\x1F]/
type Stream = { on: Function, destroy: Function }
type StreamData = { indexOf: Function }
const logsOptions = {
  stdout: true,
  stderr: true,
  follow: true,
  tail:   100
}

/** The caveman solution to detecting when the node is ready to start receiving requests:
  * trail node logs until a certain string is encountered */
export function waitUntilLogsSay (
  container: { id: string, logs: Function },
  expected:  string,
  thenDetach = true
) {
  return new Promise((ok, fail)=>{

    container.logs(logsOptions, onStream)

    function onStream (err: Error, stream: Stream) {
      if (err) return fail(err)

      console.info('Trailing logs...')
      stream.on('data', onData)

      function onData (data: StreamData) {
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

function logFilter (data: string) {
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
