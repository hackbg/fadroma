import waitPort from 'wait-port'
export { waitPort }

/** Get a random free port number by briefly running a server on a random unused port,
  * then stopping the server and returning the port number. */
import { createServer } from 'net'
export function freePort (): Promise<number> {
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

import { backOff } from "exponential-backoff"
export { backOff }
