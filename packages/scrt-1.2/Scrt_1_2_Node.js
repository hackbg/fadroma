const { PORT = 8080 } = process.env

let node
let chainId
let ready = false

const server = require('http').createServer(onRequest)

async function onRequest ({ method, url }, res) {

  const { pathname, searchParams } = new URL(url, 'http://id.gaf')

  console.debug({method, pathname, searchParams})

  let code = 400
  let data = {error:'Invalid request'}

  switch (pathname) {

    case '/spawn':
      if (['id','genesis','port'].every(param=>searchParams.has(param))) {
        if (!node) {
          code = 200
          node = spawnNode(
            chainId = searchParams.get('id'),
            searchParams.get('genesis').split(',').join(' '),
            searchParams.get('port')
          )
          data = {ok:'Spawned node'}
        } else {
          data.error = 'Node already running'
        }
      } else {
        data.error = 'Pass ?id=CHAIN_ID&genesis=NAME1,NAME2&port=PORT query param'
      }
      break

    case '/ready':
      code = 200
      data = { ready }
      break

    case '/identity':
      if (searchParams.has('name')) {
        code = 200
        const name = searchParams.get('name')
        const path = `/receipts/${chainId}/identities/${name}.json`
        data = JSON.parse(require('fs').readFileSync(path, 'utf8'))
      } else {
        data.error = 'Pass ?name=IDENTITY_NAME query param'
      }
      break

    default:
      data.valid = [
        '/spawn?id=CHAIN_ID&genesis=NAME1,NAME2',
        '/ready',
        '/identity?name=IDENTITY',
      ]

  }

  res.writeHead(code)
  res.end(JSON.stringify(data))

  console.debug({code, data})

}

function spawnNode (
  ChainID,
  GenesisAccounts,
  Port = '1317'
) {
  node = require('child_process').spawn(
    '/usr/bin/bash', [ '/Scrt_1_2_Node.sh' ], {
      stdio: [null, 'pipe', 'inherit'],
      env: { ...process.env, ChainID, GenesisAccounts, Port }
    }
  )
  let output = ''
  node.stdout.pipe(process.stdout)
  node.stdout.on('data', function waitUntilReady (data) {
    data = String(data)
    output += data
    //console.log({data})
    if (output.includes('indexed block')) {
      ready = true
      node.stdout.off('data', waitUntilReady)
    }
  })
}

server.listen(PORT)

console.log(`Fadroma Devnet listening for launch request on ${PORT}`)
