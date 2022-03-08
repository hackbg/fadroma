const { PORT = 8080 } = process.env

const builds = {}

const server = require('http').createServer(onRequest)
server.listen(PORT)
console.log(
  `Fadroma Builder for Secret Network 1.2`,
  `listening for build requests on`,
  `http://${require('os').hostname()}:${PORT}`
)

async function onRequest ({ method, url }, res) {

  const { pathname, searchParams } = new URL(url, 'http://id.gaf')
  let code = 400
  let data = {error:'Invalid request'}
  switch (pathname) {
    case '/build': await handleBuild(); break
  }
  res.writeHead(code)
  res.end(JSON.stringify(data))

  function handleBuild () {
    // mkdir -p /tmp/fadroma_build_???
    // cp -rT /src /tmp/fadroma_build_
    // git stash -u
    // git reset --hard --recurse-submodules
    // git clean -f -d -x
    // git checkout $REF
    // git submodule update --init --recursive
    // git log -1
  }

}
