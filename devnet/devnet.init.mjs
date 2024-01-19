import { env, getuid } from 'node:process'
import { spawn, exec, execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, chmodSync, watch } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

const {
  VERBOSE       = false,

  CHAIN_ID      = `dev-${DAEMON}`,
  TOKEN         = 'unspecified',
  ACCOUNTS      = '{"init":[]}',
  AMOUNT        = `1000000000000000000${TOKEN}`,

  HTTP_PORT     = '1317',
  RPC_PORT      = '26657',
  GRPC_PORT     = '9090',
  GRPC_WEB_PORT = '9091',

  DAEMON        = 'secretd',
  STATE_DIR     = `/state/${CHAIN_ID}`,
  STATE_UID     = null,
  STATE_GID     = null,
} = env

console.debug = (...args) => {
  if (VERBOSE) console.log(...args)
}

const daemonDir = resolve(homedir(), `.${DAEMON}`)
const configDir = resolve(daemonDir, `config`)
const appToml   = resolve(configDir, `app.toml`)
const genesis   = resolve(configDir, `genesis.json`)
const nodeKey   = resolve(configDir, `node_key.json`)
const stateDir  = resolve(`/state`, CHAIN_ID)
const wallets   = resolve(stateDir, `wallet`)

const run = command => {
  console.debug('$', command)
  const result = String(execSync(command)).trim()
  console.debug(result)
  return result
}

const daemon = command => run(`${DAEMON} ${command}`)

start()

function start () {
  performGenesis()
  configureNode()
  if (DAEMON === 'secretd') {
    spawnLcp()
  }
  const { node, watcher } = spawnNode()
  console.log('Devnet is running.')
}

function configureNode () {
  console.info('Configuring the node...')
  let appTomlData = readFileSync(appToml, 'utf8')
  // enable rest api if not enabled
  appTomlData = appTomlData.replace(
    new RegExp('(\\[api\\].+?)(enable = false)', 's'),
    '$1enable = true'
  )
  // enable swagger api docs on rest api endpoint
  appTomlData = appTomlData.replace(
    'swagger = false',
    'swagger = true',
  )
  if (DAEMON === 'secretd') {
    // on secret network, prepare api for lcp
    appTomlData = appTomlData.replace(
      new RegExp('address = "tcp://(localhost|0\\.0\\.0\\.0):1317"'),
      'address = "tcp://localhost:1316"'
    )
  } else {
    // on other chains, set port number and enable unsafe cors for rest api
    appTomlData = appTomlData.replace(
      new RegExp('address = "tcp://(localhost|0\\.0\\.0\\.0):1317"'),
      `address = "tcp://0.0.0.0:${HTTP_PORT}"`
    )
    appTomlData = appTomlData.replace(
      'enabled-unsafe-cors = false',
      'enabled-unsafe-cors = true',
    )
  }
  // enable unsafe cors for grpc-web
  appTomlData = appTomlData.replace(
    'enable-unsafe-cors = false',
    'enable-unsafe-cors = true',
  )
  // save updated config
  writeFileSync(appToml, appTomlData)
}

function spawnLcp () {
  // light client proxy is a reverse proxy used by secret network
  // (presumably to bypass cors?)
  console.info(`Spawning lcp (CORS proxy) on port ${HTTP_PORT}...`)
  const lcpArgs = [
    `--proxyUrl`, 'http://localhost:1316',
    `--port`, HTTP_PORT,
    `--proxyPartial`, ``
  ]
  console.debug(`$ lcp`, ...lcpArgs)
  return spawn(`lcp`, lcpArgs, { stdio: 'inherit' })
}

function spawnNode () {
  console.info(`Spawning ${DAEMON}...`)
  let command
  if (DAEMON === 'secretd') {
    // starting the secret network daemon requires sgx env vars to be set
    command = `source /opt/sgxsdk/environment && RUST_BACKTRACE=1 ${DAEMON} start --bootstrap`
  } else {
    command = `${DAEMON} start`
  }
  // add port bindings to the command line
  command += ''
    + ` --rpc.laddr tcp://0.0.0.0:${RPC_PORT}`
    + ` --grpc.address 0.0.0.0:${GRPC_PORT}`
    + ` --grpc-web.address 0.0.0.0:${GRPC_WEB_PORT}`
  console.info(`$`, command)
  let node
  try {
    node = exec(command, { shell: '/bin/bash', stdio: 'inherit' })
  } catch (e) {
    console.log('ERROR:', e.message)
    process.exit(1)
  }
  node.stdout.pipe(process.stdout)
  node.stderr.pipe(process.stderr)
  node.on('exit', (code, signal) => {
    console.info('Devnet exited. Goodbye!', { code, signal })
    process.exit(0)
  })
  const runfile = `${STATE_DIR}/devnet.run`
  writeFileSync(runfile,
    "When the devnet is running, deleting this file will kill it.\n" +
    "This is necessary because of Node's exit handlers are only reliable for synchronous operation."
  )
  chmodSync(runfile, 0o664)
  let deleted = false
  const watcher = watch(runfile, { persistent: false }, event => {
    if (!existsSync(runfile) && !deleted) {
      deleted = true
      console.log(`Runfile deleted. Stopping ${DAEMON}...`)
      node.kill()
    }
  })
  return { node, watcher }
}

function performGenesis () {
  if (existsSync(genesis)) {
    console.info(`Resuming devnet (${genesis} exists).`)
    return
  }
  console.info(`Performing genesis because ${genesis} is missing.`)
  preGenesisCleanup()
  preGenesisConfig()
  createGenesisTransaction()
  bootstrapChain()
}

function preGenesisCleanup () {
  console.info('\nEnsuring a clean slate')
  run(`rm -rf ${daemonDir}`)
  if (DAEMON === 'secretd') {
    run(`rm -rf ~/.secretcli /opt/secret/.sgx-secrets`)
  }
}

function preGenesisConfig () {
  console.info('\nEstablishing initial config')
  run(`mkdir -p ${wallets}`)
  fixPermissions()
  daemon(`config chain-id "${CHAIN_ID}"`)
  daemon(`config keyring-backend test`)
  daemon(`init fadroma-devnet --chain-id "${CHAIN_ID}"`)
  if (DAEMON === 'secretd') {
    run(`cp ~/node_key.json ${nodeKey}`)
  }
  console.log('Patching', genesis)
  let genesisData = readFileSync(genesis, 'utf8')
  genesisData = genesisData.replace(
    new RegExp('"stake"', 'g'),
    `"${TOKEN}"`
  )
  writeFileSync(genesis, genesisData)
}

function createGenesisTransaction () {
  let accounts = JSON.parse(ACCOUNTS||'{}') || {}
  if (Object.keys(accounts).length === 0) {
    accounts = { 'Admin': '1000000000000' }
  }
  console.info('Creating genesis accounts:')
  for (const [name, amount] of Object.entries(accounts)) {
    const mnemonic = daemon(`keys add "${name}" 2>&1 | tail -n1`)
    const address  = daemon(`keys show -a "${name}"`)
    console.info(`\n\n${address} (${name})\n  ${mnemonic}\n  ${amount}${TOKEN}`)
    daemon(`add-genesis-account "${address}" "${amount}${TOKEN}"`)
    const identity = `${wallets}/${name}.json`
    writeFileSync(identity, JSON.stringify({ address, mnemonic }))
    fixPermissions(identity)
  }
  fixPermissions()
  console.info('\nCreating genesis transaction...')
  daemon(
    `gentx "${Object.keys(accounts)[0]}" 1000000${TOKEN} --chain-id ${CHAIN_ID} --keyring-backend test`
  )
}

function bootstrapChain () {
  console.info('\nBootstrapping chain')
  daemon(`collect-gentxs`)
  daemon(`validate-genesis`)
  if (DAEMON === 'secretd') {
    daemon(`init-bootstrap`)
  }
  daemon(`validate-genesis`)
}

function fixPermissions (path = stateDir) {
  if (STATE_UID) {
    run(`chown -R ${STATE_UID} ${stateDir}`)
  }
  if (STATE_GID) {
    run(`chgrp -R ${STATE_GID} ${stateDir}`)
  }
}
