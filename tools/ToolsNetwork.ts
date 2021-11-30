import { bold, Console } from './ToolsCLI'

const console = Console(import.meta.url)

import { createServer } from 'net'

import Docker from 'dockerode'
export { Docker }

import waitPort from 'wait-port'
export { waitPort }

/** Get a random free port number by briefly running a server on a random unused port,
  * then stopping the server and returning the port number. */
export const freePort = () => new Promise((ok, fail)=>{
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

/** Make sure an image is present in the Docker cache
  * (by pulling it if `docker.getImage` throws). */
export const pulled = async (imageName: string, docker = new Docker()) => {

  try {

    // throws if inspected image does not exist:
    const image = docker.getImage(imageName)
    await image.inspect()

  } catch (_e) {

    console.warn(`Image ${imageName} not found, pulling...`)

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

  // return just the name
  return imageName

}

const RE_GARBAGE = /[\x00-\x1F]/

/** The caveman solution to detecting when the node is ready to start receiving requests:
  * trail node logs until a certain string is encountered */
export const waitUntilLogsSay = (
  container: { id: string, logs: Function },
  expected:  string,
  thenDetach = false
) => new Promise((ok, fail)=> container.logs(

  { stdout: true, stderr: true, follow: true, tail: 100 },

  (err: Error, stream: { on: Function, destroy: Function }) => {

    if (err) return fail(err)

    console.info('Trailing logs...')

    stream.on('data', function read (data: { indexOf: Function }) {

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
  }
))

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
