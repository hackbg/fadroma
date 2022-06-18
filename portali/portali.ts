import * as net from 'net'
import { backOff } from "exponential-backoff"

export { backOff }

/** Get a random free port number by briefly running a server on a random unused port,
  * then stopping the server and returning the port number. */
export function freePort (): Promise<number> {
  return new Promise((ok, fail)=>{
    let port = 0
    const server = net.createServer()
    server.on('listening', () => {
      port = (server.address() as { port: number }).port
      server.close()
    })
    server.on('close', () => ok(port))
    server.on('error', fail)
    server.listen(0, '127.0.0.1')
  })
}

/** Based on https://github.com/Chris927/wait-for-host/blob/master/LICENSE */
export function waitPort ({
  host = 'localhost',
  port,
  retries   = 10,
  interval  = 1000,
}: {
  host:      string
  port:      number
  retries?:  number
  interval?: number
}): Promise<void> {

  let timer
  let socket

  return new Promise<void>((resolve, reject)=>{

    tryToConnect()

    function tryToConnect() {

      clearTimerAndDestroySocket()

      if (--retries < 0) {
        reject(new Error('out of retries'))
      }

      socket = net.createConnection(port, host, () => {
        clearTimerAndDestroySocket()
        if (retries > 0) resolve()
      });

      timer = setTimeout(function() { retry() }, interval)

      socket.on('error', () => {
        clearTimerAndDestroySocket()
        setTimeout(retry, interval)
      })

    }

    function clearTimerAndDestroySocket() {
      clearTimeout(timer)
      timer = null
      if (socket) socket.destroy()
      socket = null
    }

    function retry() {
      tryToConnect()
    }

  })

}
