import { spawn, exec, execSync } from 'child_process'
import { existsSync, writeFileSync, chmodSync } from 'fs'

const run = command => {
  if (process.env.Verbose) console.info('$', command)
  const result = String(execSync(command)).trim()
  if (process.env.Verbose) console.info(result)
  return result
}

start()

function start ({
  lcpPort     = process.env.lcpPort     || '1317',
  rpcAddr     = process.env.rpcAddr     || 'tcp://0.0.0.0:26657',
  grpcAddr    = process.env.grpcAddr    || '0.0.0.0:9090',
  grpcWebAddr = process.env.grpcWebAddr || '0.0.0.0:9091',
  genesisJSON = '~/.secretd/config/genesis.json',
  uid = process.env._UID,
  gid = process.env._GID
} = {}) {
  if (!existsSync(genesisJSON)) {
    console.info(`${genesisJSON} missing -> performing genesis`)
    genesis()
  } else {
    console.info(`${genesisJSON} exists -> resuming devnet`)
  }

  console.info('Configuring the node to support lcp (CORS proxy)...')
  run(`perl -i -pe 's;address = "tcp://0.0.0.0:1317";address = "tcp://0.0.0.0:1316";' .secretd/config/app.toml`)
  run(`perl -i -pe 's/enable-unsafe-cors = false/enable-unsafe-cors = true/' .secretd/config/app.toml`)
  const lcpArgs = [`--proxyUrl`, 'http://localhost:1316', `--port`, lcpPort, `--proxyPartial`, ``]

  console.info('Spawning lcp (CORS proxy)...')
  if (process.env.Verbose) console.log(`$ lcp`, ...lcpArgs)
  const lcp = spawn(`lcp`, lcpArgs, { stdio: 'inherit' })

  console.info('Launching the node...')
  const command = `source /opt/sgxsdk/environment && RUST_BACKTRACE=1 secretd start --bootstrap`
    + ` --rpc.laddr ${rpcAddr}`
    + ` --grpc.address ${grpcAddr}`
    + ` --grpc-web.address ${grpcWebAddr}`
  console.info(`$`, command)
  execSync(command, { shell: '/bin/bash', stdio: 'inherit' })
  console.info('Server exited.')
}

function genesis ({
  chainId         = process.env.ChainId || 'fadroma-devnet',
  stateDir        = `/state/${chainId}`,
  genesisAccounts = (process.env.GenesisAccounts || 'Admin Alice Bob Charlie Mallory').split(' '),
  amount          = "1000000000000000000uscrt"
} = {}) {
  console.info('\nEnsuring a clean slate...')
  run(`rm -rf ~/.secretd ~/.secretcli /opt/secret/.sgx-secrets`)

  console.info('\nEstablishing initial config...')
  run(`mkdir -p ${stateDir} ${stateDir}/wallet`)
  run(`secretd config chain-id "${chainId}"`)
  run(`secretd config keyring-backend test`)
  run(`secretd init fadroma-devnet --chain-id "${chainId}"`)
  run(`cp ~/node_key.json ~/.secretd/config/node_key.json`)
  run(`perl -i -pe 's/"stake"/ "uscrt"/g' ~/.secretd/config/genesis.json`)

  console.info('\nCreating genesis accounts', genesisAccounts)
  for (const name of genesisAccounts) {
    const mnemonic = run(`secretd keys add "${name}" 2>&1 | tail -n1`)
    const address  = run(`secretd keys show -a "${name}"`)
    const identity = `${stateDir}/wallet/${name}.json`
    writeFileSync(identity, JSON.stringify({ address, mnemonic }))
    if (uid) run(`chown ${uid} ${identity}`)
    if (gid) run(`chgrp ${gid} ${identity}`)
  }

  console.info('\nAdding genesis accounts...')
  for (const name of genesisAccounts) {
    const address = run(`secretd keys show -a "${name}"`)
    run(`secretd add-genesis-account "${address}" "${amount}"`)
  }

  console.info('\nCreating genesis transaction...')
  run(`secretd gentx "${genesisAccounts[0]}" 1000000uscrt --chain-id ${chainId} --keyring-backend test`)

  console.info('\nBootstrapping chain...')
  run(`secretd collect-gentxs`)
  run(`secretd validate-genesis`)
  run(`secretd init-bootstrap`)
  run(`secretd validate-genesis`)

  console.info('\nSprinkling holy water...')
  console.info()
}
