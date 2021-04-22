import { createServer } from 'net'
import Docker from 'dockerode'
import waitPort from 'wait-port'

export { waitPort }

export const freePort = () => new Promise((ok, fail)=>{
  let port = 0
  const server = createServer()
  server.on('listening', () => { port = server.address().port; server.close() })
  server.on('close', () => ok(port))
  server.on('error', fail)
  server.listen(0, '127.0.0.1')
})

export const pull = async (image, docker = new Docker()) => {
  try {
    // throws if image does not exist:
    await (await docker.getImage(image)).inspect()
  } catch (e) {
    console.debug(`docker pulling ${image}...`)
    await new Promise((ok, fail)=>{
      docker.pull(image, (err, stream) => {
        if (err) return fail(err)
        docker.modem.followProgress(stream,
          (err, output) => {
            if (err) return fail(err)
            console.log(`pull ok`)
            ok()
          },
          event => {
            event = ['id', 'status', 'progress'].map(x=>event[x]).join('│')
            console.debug(`docker pull says:`, event)
          }
        )
      })
    })
  }
  return image
}

export const waitUntilLogsSay = (container, string) => new Promise((ok, fail)=>
  container.logs({stdout: true, stderr: true, follow: true, tail: 100}, (err, stream) => {
    if (err) return fail(err)
    console.debug('trailing logs...')
    stream.on('data', function read (data) {
      data = String(data)
      console.debug(container.id.slice(0,8), `says:`, String(data).trim())
      if (data.indexOf(string)>-1) {
        stream.destroy()
        console.debug('waiting for good measure...')
        return setTimeout(ok, 7000)
      }
      //if (data.indexOf('ERROR')>-1) { // TODO ignore benign error
        //stream.destroy()
        //console.error(`localnet failed to spawn: ${data}`)
        //container.stop().then(()=>container.remove().then(()=>console.debug(`removed ${id}`)))
        //unlink(nodeState).then(()=>console.debug(`deleted ${nodeState}`))
        //return fail(data)
      //}
    })
  }))
