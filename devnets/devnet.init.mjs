import { env, getuid } from 'node:process'
import { spawn, exec, execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'

const {
  VERBOSE       = false,

  CHAIN_ID      = `local-${DAEMON}`,
  TOKEN         = 'uscrt',
  ACCOUNTS      = 'Admin Alice Bob Charlie Mallory',
  AMOUNT        = `1000000000000000000${TOKEN}`,

  LCP_PORT      = '1317',
  RPC_ADDR      = 'tcp://0.0.0.0:26657',
  GRPC_ADDR     = '0.0.0.0:9090',
  GRPC_WEB_ADDR = '0.0.0.0:9091',

  DAEMON        = 'secretd',
  STATE_DIR     = `/state/${CHAIN_ID}`,
  STATE_UID     = null,
  STATE_GID     = null,
} = env

const daemonDir = `~/.${DAEMON}`
const configDir = `${daemonDir}/config`
const appToml   = `${configDir}/app.toml`
const genesis   = `${configDir}/genesis.json`
const nodeKey   = `${configDir}/node_key.json`
const stateDir  = `/state/${CHAIN_ID}`
const wallets   = `${stateDir}/wallet`

start()

function start () {
  performGenesis()
  spawnLcp()
  launchNode()
  console.info('Server exited.')
}

function spawnLcp () {
  console.info('Configuring the node to support lcp (CORS proxy)...')
  if (DAEMON === 'secretd') {
    //let appTomlData = readFileSync(appToml)
    run(`perl -i -pe 's;address = "tcp://0.0.0.0:1317";address = "tcp://0.0.0.0:1316";' ${appToml}`)
    run(`perl -i -pe 's/enable-unsafe-cors = false/enable-unsafe-cors = true/' ${appToml}`)
  }
  //let appTomlData = readFileSync(appToml)
  //appTomlData = appTomlData.replace('address = "tcp://0.0.0.0:1317"', 'address = "tcp://0.0.0.0:1316')
  //appTomlData = appTomlData.replace('enable-unsafe-cors = false', 'enable-unsafe-cors = false')
  //writeFileSync(appToml, appTomlData)
  const lcpArgs = [
    `--proxyUrl`, 'http://localhost:1316',
    `--port`, LCP_PORT,
    `--proxyPartial`, ``
  ]
  console.info(`Spawning lcp (CORS proxy) on port ${LCP_PORT}`)
  if (VERBOSE) console.log(`$ lcp`, ...lcpArgs)
  const lcp = spawn(`lcp`, lcpArgs, { stdio: 'inherit' })
}

function launchNode () {
  console.info('Launching the node...')
  let command
  if (DAEMON === 'secretd') {
    command = `source /opt/sgxsdk/environment && RUST_BACKTRACE=1 ${DAEMON} start --bootstrap`
      + ` --rpc.laddr ${RPC_ADDR}`
      + ` --grpc.address ${GRPC_ADDR}`
      + ` --grpc-web.address ${GRPC_WEB_ADDR}`
  } else {
    command = `${DAEMON} start`
  }
  command += ''
    + ` --rpc.laddr ${RPC_ADDR}`
    + ` --grpc.address ${GRPC_ADDR}`
    + ` --grpc-web.address ${GRPC_WEB_ADDR}`
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
  console.info('\nSprinkling holy water...')
  console.info()
}

function preGenesisCleanup () {
  console.info('\nEnsuring a clean slate...')
  run(`rm -rf ${daemonDir}`)
  if (DAEMON === 'secretd') {
    run(`~/.secretcli /opt/secret/.sgx-secrets`)
  }
}

function preGenesisConfig () {
  console.info('\nEstablishing initial config...')
  run(`mkdir -p ${wallets}`)
  fixPermissions()
  daemon(`config chain-id "${CHAIN_ID}"`)
  daemon(`config keyring-backend test`)
  daemon(`init fadroma-devnet --chain-id "${CHAIN_ID}"`)
  if (DAEMON === 'secretd') {
    run(`cp ~/node_key.json ${nodeKey}`)
  }
  console.log('Patching', genesis)
  run(`perl -i -pe 's/"stake"/ "${TOKEN}"/g' ${genesis}`)
}

function createGenesisTransaction () {
  let accounts = ACCOUNTS.split(' ')
  if (accounts.length === 0) accounts = ['Admin']
  console.info('\nCreating genesis accounts:')
  for (const name of accounts) {
    const mnemonic = daemon(`keys add "${name}" 2>&1 | tail -n1`)
    const address  = daemon(`keys show -a "${name}"`)
    console.info(`\n- ${AMOUNT} ${address} (${name})`)
    daemon(`add-genesis-account "${address}" "${AMOUNT}"`)
    const identity = `${wallets}/${name}.json`
    writeFileSync(identity, JSON.stringify({ address, mnemonic }))
    fixPermissions(identity)
  }
  fixPermissions()
  console.info('\nCreating genesis transaction...')
  daemon(`gentx "${accounts[0]}" 1000000${TOKEN} --chain-id ${CHAIN_ID} --keyring-backend test`)
}

function bootstrapChain () {
  console.info('\nBootstrapping chain...')
  daemon(`collect-gentxs`)
  daemon(`validate-genesis`)
  if (DAEMON === 'secretd') {
    daemon(`init-bootstrap`)
  }/* else {
    daemon(`init ${CHAIN_ID}`)
  }*/
  daemon(`validate-genesis`)
}

function fixPermissions (path = stateDir) {
  if (STATE_UID) run(`chown -R ${STATE_UID} ${stateDir}`)
  if (STATE_GID) run(`chgrp -R ${STATE_GID} ${stateDir}`)
}

function run (command) {
  if (VERBOSE) console.info('$', command)
  const result = String(execSync(command)).trim()
  if (VERBOSE) console.info(result)
  return result
}

function daemon (command) {
  return run(`${DAEMON} ${command}`)
}
