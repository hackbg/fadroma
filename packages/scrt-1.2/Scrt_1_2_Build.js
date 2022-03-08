const {
  PORT          = 8080,
  FADROMA_QUIET = false
} = process.env

const builds = {}

const server = require('http').createServer(onRequest)
server.listen(PORT)
console.log(
  `Fadroma Builder for Secret Network 1.2`,
  `listening for build requests on`,
  `http://${require('os').hostname()}:${PORT}`
)

async function onRequest ({ method, url }, res) {

  const routes = {
    '/build': handleBuild
  }

  const { pathname, searchParams } = new URL(url, 'http://id.gaf')
  let code = 400
  let data = {error:'Invalid request'}
  if (routes[pathname]) await routes[pathname]()
  res.writeHead(code)
  res.end(JSON.stringify(data))

  async function handleBuild () {
    if (!searchParams.has('crate')) {
      data.error = 'Pass ?crate=CRATE'
    } else {
      const stdio = FADROMA_QUIET ? 'ignore' : 'inherit'
      const crate = searchParams.get('crate')
      const ref   = searchParams.get('ref')
      return new Promise((resolve, reject)=>{
        require('child_process').execFile(
          '/bin/bash', [ '/Scrt_1_2_Build.sh' ], {
            stdio: [null, stdio, stdio],
            env: { ...process.env }
          }, (error, stdout, stderr) => {
            if (error) return reject(error)
            resolve()
          }
        )
      })
    }
  }

}
