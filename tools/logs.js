import Console from '@hackbg/konzola'
const console = Console('@hackbg/tools/logs')

import colors from 'colors'
const { bold } = colors

const RE_GARBAGE = /[\x00-\x1F]/
const logsOptions = {
  stdout: true,
  stderr: true,
  follow: true,
  tail:   100
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
