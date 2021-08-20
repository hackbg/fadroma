import { bold } from '@fadroma/cli'

import { createServer } from 'net'

import Docker from 'dockerode'
export { Docker }

import waitPort from 'wait-port'
export { waitPort }

export const freePort = () => new Promise((ok, fail)=>{
  let port = 0
  const server = createServer()
  server.on('listening', () => { port = server.address().port; server.close() })
  server.on('close', () => ok(port))
  server.on('error', fail)
  server.listen(0, '127.0.0.1') })

export const pulled = async (imageName: string, docker = new Docker()) => {
  try {
    // throws if inspected image does not exist:
    const image = docker.getImage(imageName)
    await image.inspect() }
  catch (e) {
    console.debug(`docker pulling ${imageName}...`)
    await new Promise<void>((ok, fail)=>{
      docker.pull(imageName, (err, stream) => {
        if (err) return fail(err)
        docker.modem.followProgress(stream,
          (err, output) => {
            if (err) return fail(err)
            console.log(`pull ok`)
            ok() },
          event => {
            event = ['id', 'status', 'progress'].map(x=>event[x]).join('│')
            console.debug(`📦 docker pull says:`, event) } ) }) }) }
  // return just the name
  return imageName }

const RE_GARBAGE = /[\x00-\x1F]/

/** Trail node logs forever, try to filter irrelevant lines (probably too strict by now)
 *  and resolve a promise the first time they contain a certain string.
 *  This is the caveman solution to detecting when the node is ready
 *  to start receiving requests. */
export const waitUntilLogsSay = (container, string, thenDetach = false) => new Promise((ok, fail)=>
  container.logs({stdout: true, stderr: true, follow: true, tail: 100}, (err, stream) => {
    if (err) return fail(err)
    console.debug('⬇️  trailing logs...')
    stream.on('data', function read (data) {
      data = String(data).trim()
      if (logFilter(data)) {
        console.debug('📦', bold(`${container.id.slice(0,8)} says:`), String(data).trim()) }
      if (data.indexOf(string)>-1) {
        if (thenDetach) stream.destroy()
        const seconds = 7
        console.debug(`⏳`, bold(`waiting ${seconds} seconds`), `for good measure...`)
        return setTimeout(ok, seconds * 1000) } }) }))

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
