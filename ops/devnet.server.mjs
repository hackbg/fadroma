import { createServer } from 'http'
import { hostname } from 'os'
import { readFileSync } from 'fs'
import { spawn } from 'child_process'
import assert, { AssertionError } from 'assert'

const {
  PORT =
    8080,
  FADROMA_QUIET =
    false,
  FADROMA_DEVNET_INIT_SCRIPT =
    '/devnet.init.mjs',
  FADROMA_DEVNET_READY_PHRASE =
    'indexed block'
} = process.env

let node
let chainId
let genesis
let lcpPort
let grpcWebAddr
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

  const { pathname, searchParams: query } = new URL(url, 'http://id.gaf')
  let code = 400
  let data = {error:'Invalid request'}
  if (routes[pathname]) routes[pathname]()
  res.writeHead(code)
  res.end(JSON.stringify(data))

  function handleSpawn () {
    if (node) {
      data = { error: 'Node already running', lcpPort, grpcWebAddr }
      return
    }
    try {
      assert(query.has('id'),
        "required URL parameter: 'id'")
      assert(query.has('genesis'),
        "required URL parameter: 'genesis'")
      assert(query.has('lcpPort')||query.has('grpcWebAddr'),
        "required URL parameter: 'lcpPort' or 'grpcWebAddr'")
    } catch (e) {
      if (e instanceof AssertionError) {
        data.error = e.message
        return
      } else {
        throw e
      }
    }
    node = spawnNode(
      chainId     = query.get('id'),
      genesis     = query.get('genesis').split(',').join(' '),
      lcpPort     = query.get('lcpPort'),
      grpcWebAddr = query.get('grpcWebAddr')
    )
    code = 200
    data = { ok: 'Spawned node' }
  }

  function handleReady () {
    code = 200
    data = { ready }
  }

  function handleId () {
    if (query.has('name')) {
      code = 200
      const name = query.get('name')
      const path = `/state/${chainId}/wallet/${name}.json`
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
  ChainId,
  GenesisAccounts,
  lcpPort,
  grpcWebAddr
) {
  console.log('Fadroma Devnet Manager: spawning devnet node', { ChainId, GenesisAccounts, lcpPort, grpcWebAddr })
  const env  = { ...process.env, ChainId, GenesisAccounts, lcpPort, grpcWebAddr }
  const opts = { stdio: [null, 'pipe', 'pipe'], env }
  const node = spawn(process.argv[0], [ FADROMA_DEVNET_INIT_SCRIPT ], opts)
  if (!FADROMA_QUIET) {
    node.stdout.pipe(process.stdout)
    node.stderr.pipe(process.stderr)
  }
  let output = ''
  node.stderr.on('data', function waitUntilReady (data) {
    data = String(data)
    output += data
    if (output.includes(FADROMA_DEVNET_READY_PHRASE)) {
      ready = true
      node.stderr.off('data', waitUntilReady)
    }
  })
  return node
}
