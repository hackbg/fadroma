import { createServer } from 'http'
import { hostname } from 'os'
import { readFileSync } from 'fs'
import { spawn } from 'child_process'

const {
  PORT =
    8080,
  FADROMA_QUIET =
    false,
  FADROMA_DEVNET_INIT_SCRIPT =
    '/devnet-init.mjs',
  FADROMA_DEVNET_READY_PHRASE =
    'indexed block'
} = process.env

let node
let chainId
let ready = false

const server = createServer(onRequest)
server.listen(PORT, () => {
  console.log(
    `Fadroma Devnet for Secret Network 1.2`,
    `listening for launch request on`,
    `http://${hostname()}:${PORT}`
  )
})

function onRequest ({ method, url }, res) {

  const routes = {
    '/spawn': handleSpawn,
    '/ready': handleReady,
    '/identity': handleId
  }

  const { pathname, searchParams } = new URL(url, 'http://id.gaf')
  let code = 400
  let data = {error:'Invalid request'}
  if (routes[pathname]) routes[pathname]()
  res.writeHead(code)
  res.end(JSON.stringify(data))

  function handleSpawn () {
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
  }

  function handleReady () {
    code = 200
    data = { ready }
  }

  function handleId () {
    if (searchParams.has('name')) {
      code = 200
      const name = searchParams.get('name')
      const path = `/receipts/${chainId}/identities/${name}.json`
      try {
        data = JSON.parse(readFileSync(path, 'utf8'))
      } catch (e) {
        code = 404
        data.error = `Failed to get ${name} on ${chainId}: ${e.message}`
      }
    } else {
      code = 404
      data.error = 'Pass ?name=IDENTITY_NAME query param'
    }
  }
}

function spawnNode (
  ChainID,
  GenesisAccounts,
  Port = '1317'
) {
  const { stdout, stderr } = node = spawn(
    process.argv[0], [ FADROMA_DEVNET_INIT_SCRIPT ], {
      stdio: [null, 'pipe', 'pipe'],
      env: { ...process.env, ChainID, GenesisAccounts, Port }
    }
  )
  if (!FADROMA_QUIET) {
    stdout.pipe(process.stdout)
    stderr.pipe(process.stderr)
  }
  let output = ''
  stderr.on('data', function waitUntilReady (data) {
    data = String(data)
    output += data
    if (output.includes(FADROMA_DEVNET_READY_PHRASE)) {
      ready = true
      stderr.off('data', waitUntilReady)
    }
  })
}
