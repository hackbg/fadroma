import { exec, execSync } from 'child_process'
import { existsSync, writeFileSync } from 'fs'

const run = command => {
  console.info('$', command)
  const result = String(execSync(command)).trim()
  console.info(result)
  return result
}

start()

function start ({
  lcpAddr     = process.env.lcpAddr     || 'http://localhost:1317',
  lcpPort     = process.env.lcpPort     || '1316',
  rpcAddr     = process.env.rpcAddr     || 'tcp://0.0.0.0:26657',
  grpcAddr    = process.env.grpcAddr    || '0.0.0.0:9090',
  grpcWebAddr = process.env.grpcWebAddr || '0.0.0.0:9091',
  genesisJSON = '~/.secretd/config/genesis.json',
} = {}) {
  if (!existsSync(genesisJSON)) {
    console.info(`${genesisJSON} missing -> performing genesis`)
    genesis()
  } else {
    console.info(`${genesisJSON} exists -> resuming devnet`)
  }
  run(`perl -i -pe 's;address = "tcp://0.0.0.0:1317";address = "tcp://0.0.0.0:1316";' .secretd/config/app.toml`)
  run(`perl -i -pe 's/enable-unsafe-cors = false/enable-unsafe-cors = true/' .secretd/config/app.toml`)
  const lcp = exec(`lcp --proxyUrl ${lcpAddr} --port ${lcpPort} --proxyPartial ''`)
  const command = `source /opt/sgxsdk/environment && RUST_BACKTRACE=1 secretd start --bootstrap`
    + ` --rpc.laddr ${rpcAddr}`
    + ` --grpc.address ${grpcAddr}`
    + ` --grpc-web.address ${grpcWebAddr}`
  console.info(`$`, command)
  execSync(command, { shell: '/bin/bash', stdio: 'inherit' })
}

function genesis ({
  chainId         = process.env.ChainId || 'fadroma-devnet',
  stateDir        = `/receipts/${chainId}`,
  genesisAccounts = (process.env.GenesisAccounts || 'ADMIN ALICE BOB CHARLIE MALLORY').split(' '),
  amount          = "1000000000000000000uscrt"
} = {}) {
  console.info('\nI. Denial')
  run(`rm -rf ~/.secretd ~/.secretcli /opt/secret/.sgx-secrets`)
  run(`mkdir -p ${stateDir} ${stateDir}/identities`)
  run(`secretd config chain-id "${chainId}"`)
  run(`secretd config keyring-backend test`)
  run(`secretd init fadroma-devnet --chain-id "${chainId}"`)
  run(`cp ~/node_key.json ~/.secretd/config/node_key.json`)
  run(`perl -i -pe 's/"stake"/ "uscrt"/g' ~/.secretd/config/genesis.json`)

  console.info('\nII. Anger')
  for (const name of genesisAccounts) {
    const mnemonic = run(`secretd keys add "${name}" 2>&1 | tail -n1`)
    const address  = run(`secretd keys show -a "${name}"`)
    const identity = `${stateDir}/identities/${name}.json`
    writeFileSync(identity, JSON.stringify({ address, mnemonic }))
    run(`chmod a+rw ${identity}`)
  }

  console.info('\nIII. Bargaining')
  for (const name of genesisAccounts) {
    const address = run(`secretd keys show -a "${name}"`)
    run(`secretd add-genesis-account "${address}" "${amount}"`)
  }

  console.info('\nIV. Depression')
  run(`secretd gentx "${genesisAccounts[0]}" 1000000uscrt --chain-id ${chainId} --keyring-backend test`)

  console.info('\nV. Acceptance')
  run(`secretd collect-gentxs`)
  run(`secretd validate-genesis`)
  run(`secretd init-bootstrap`)
  run(`secretd validate-genesis`)

  console.info()
}
