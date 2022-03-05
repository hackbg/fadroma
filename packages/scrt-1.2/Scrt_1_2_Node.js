const { PORT = 8080 } = process.env

let node

const server = require('http').createServer(onRequest)

function onRequest ({ method, url }, res) {

  const { pathname, searchParams } = new URL(url, 'http://id.gaf')

  console.debug({method, pathname, searchParams})

  let code = 400
  let data = {error:'Invalid request'}

  switch (pathname) {

    case '/spawn':
      if (searchParams.has('id') && searchParams.has('genesis')) {
        if (!node) {
          code = 200
          node = spawnNode(
            searchParams.get('id'),
            searchParams.get('genesis').split(',').join(' ')
          )
          data = {ok:'Spawned node'}
        } else {
          data.error = 'Node already running'
        }
      } else {
        data.error = 'Pass ?id=CHAIN_ID&genesis=NAME1,NAME2 query param'
      }
      break

    case '/identity':
      if (searchParams.has('name')) {
        code = 200
        const name = searchParams.get('name')
        data = JSON.parse(require('fs').readFileSync(`/shared_key/${name}`, 'utf8'))
      } else {
        data.error = 'Pass ?name=IDENTITY_NAME query param'
      }
      break

    default:
      data.valid = ['/spawn?id=CHAIN_ID&genesis=NAME1,NAME2', '/identity?name=IDENTITY']

  }

  res.writeHead(code)
  res.end(JSON.stringify(data))

  console.debug({code, data})

}

function spawnNode (
  CHAINID,
  GenesisAccounts,
  Port = '1317'
) {
  node = require('child_process').spawn(
    '/usr/bin/bash',
    [ '/Scrt_1_2_Node.sh' ],
    { stdio: 'inherit', env: { ...process.env, CHAINID, GenesisAccounts, Port } }
  )
}

server.listen(PORT)

console.log(`Fadroma Devnet listening for launch request on ${PORT}`)
