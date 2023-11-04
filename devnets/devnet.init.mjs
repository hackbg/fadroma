import { env, getuid } from 'node:process'
import { spawn, exec, execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { homedir } from 'node:os'
import { resolve } from 'node:path'

const {
  VERBOSE       = false,

  CHAIN_ID      = `local-${DAEMON}`,
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

start()

function start () {
  performGenesis()
  configureNode()
  if (DAEMON === 'secretd') {
    spawnLcp()
  }
  launchNode()
  console.info('Server exited.')
}

function configureNode () {
  console.info('Configuring the node')
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
  const lcpArgs = [
    `--proxyUrl`, 'http://localhost:1316',
    `--port`, HTTP_PORT,
    `--proxyPartial`, ``
  ]
  console.info(`Spawning lcp (CORS proxy) on port ${HTTP_PORT}`)
  console.debug(`$ lcp`, ...lcpArgs)
  const lcp = spawn(`lcp`, lcpArgs, { stdio: 'inherit' })
}

function launchNode () {
  console.info('Launching the node')
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
  try {
    execSync(command, { shell: '/bin/bash', stdio: 'inherit' })
  } catch (e) {
    console.log('ERROR:', e.message)
    process.exit(1)
  }
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
  console.info('\nSprinkling holy water')
  console.info()
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
  console.info('\nCreating genesis accounts:')
  for (const [name, amount] of Object.entries(accounts)) {
    const mnemonic = daemon(`keys add "${name}" 2>&1 | tail -n1`)
    const address  = daemon(`keys show -a "${name}"`)
    console.info(`\n- ${amount}${TOKEN} ${address} (${name})`)
    daemon(`add-genesis-account "${address}" "${amount}${TOKEN}"`)
    const identity = `${wallets}/${name}.json`
    writeFileSync(identity, JSON.stringify({ address, mnemonic }))
    fixPermissions(identity)
  }
  fixPermissions()
  console.info('\nCreating genesis transaction')
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

function run (command) {
  console.debug('$', command)
  const result = String(execSync(command)).trim()
  console.debug(result)
  return result
}

function daemon (command) {
  return run(`${DAEMON} ${command}`)
}
