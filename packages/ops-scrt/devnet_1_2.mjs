import { exec, execSync } from 'child_process'
import { existsSync, writeFileSync } from 'fs'

const config = {
  port:            '1234',
  genesisJSON:     '~/.secretd/config/genesis.json',
  stateDir:        '/state',
  chainId:         'fadroma-devnet',
  genesisAccounts: ['ADMIN', 'ALICE', 'BOB', 'CHARLIE', 'MALLORY'],
  amount:          "1000000000000000000uscrt"
}

const run = command => {
  console.info('$', command)
  const result = String(execSync(command)).trim()
  console.info(result)
  return result
}

if (!existsSync(config.genesisJSON)) {
  console.info(`${config.genesisJSON} missing -> performing genesis`)
  console.info('1. Denial')
  run(`rm -rf ~/.secretd ~/.secretcli /opt/secret/.sgx-secrets`)
  run(`mkdir -p ${config.stateDir} ${config.stateDir}/identities`)
  run(`secretd config chain-id "${config.chainId}"`)
  run(`secretd config keyring-backend test`)
  run(`secretd init fadroma-devnet --chain-id "${config.chainId}"`)
  run(`cp ~/node_key.json ~/.secretd/config/node_key.json`)
  run(`perl -i -pe 's/"stake"/ "uscrt"/g' ~/.secretd/config/genesis.json`)
  console.info('2. Anger')
  for (const name of config.genesisAccounts) {
    const mnemonic = run(`secretd keys add "${name}" 2>&1 | tail -n1`)
    const address  = run(`secretd keys show -a "${name}"`)
    const identity = `${config.stateDir}/identities/${name}.json`
    writeFileSync(identity, JSON.stringify({ address, mnemonic }))
    run(`chmod a+rw ${identity}`)
  }
  console.info('3. Bargaining')
  for (const name of config.genesisAccounts) {
    const address = run(`secretd keys show -a "${name}"`)
    run(`secretd add-genesis-account "${address}" "${config.amount}"`)
  }
  console.info('4. Depression')
  run(`secretd gentx "${config.genesisAccounts[0]}" 1000000uscrt --chain-id ${config.chainId} --keyring-backend test`)
  console.info('5. Acceptance')
  run(`secretd collect-gentxs`)
  run(`secretd validate-genesis`)
  run(`secretd init-bootstrap`)
  run(`secretd validate-genesis`)
} else {
  console.info(`${config.genesisJSON} exists -> resuming devnet`)
}

const lcp = exec(`lcp --proxyUrl http://localhost:1317 --port ${config.port} --proxyPartial ''`)
run(`source /opt/sgxsdk/environment && export RUST_BACKTRACE=1 secretd start --rpc.laddr tcp://0.0.0.0:26657 --bootstrap`)
