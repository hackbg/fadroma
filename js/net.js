import { createServer } from 'net'
import waitPort from 'wait-port'

export function freePort () {
  return new Promise((ok, fail)=>{
    let port = 0
    const server = createServer()
    server.on('listening', () => { port = server.address().port; server.close() })
    server.on('close', () => ok(port))
    server.on('error', fail)
    server.listen(0, '127.0.0.1')
  })
}

export { waitPort }
