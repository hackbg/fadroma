import Docker from 'dockerode'

import { loadJSON } from '../schema.js'
import {
  resolve, mkdir, existsSync, touch, dirname, fileURLToPath, readFile, writeFile
} from '../sys.js'
import { waitPort, freePort, pull, waitUntilLogsSay } from '../net.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

const {warn, debug, info} = console

/** @class
 * Manages lifecycle of docker container for localnet.
 */
export default class SecretNetworkNode {
  /**Interface to a REST API endpoint. Can store wallets and results of contract uploads/inits.
   * @constructor
   * @param {Object} options - the node options
   * @param {string} options.chainId - chain id
   * @param {string} options.protocol - http or https
   * @param {string} options.host - normally localhost
   * @param {number} options.port - normally 1337
   * @param {number} options.keysState - directory to store genesis accounts
   */
  constructor (options = {}) {
    const { chainId  = 'enigma-pub-testnet-3'
          , protocol = 'http'
          , host     = 'localhost'
          , port     = 1337
          , keysState } = options
    Object.assign(this, { chainId, protocol, host, port, keysState })
    const ready = waitPort({ host: this.host, port: this.port }).then(()=>this)
    Object.defineProperty(this, 'ready', { get () { return ready } })
  }
  /**Return one of the genesis accounts stored when creating the node.
   * @param {string} name - the name of the account. */
  genesisAccount = name =>
    loadJSON(resolve(this.keysState, `${name}.json`))

  /**Wake up a stopped localnet container, or create one
   */
  static async respawn (options={}) {
    // chain id and storage paths for this node
    const { chainId   = 'enigma-pub-testnet-3'
          , state     = makeStateDir(defaultDataDir(), 'fadroma', chainId)
          , nodeState = resolve(state, 'node.json')
          , keysState = mkdir(state, 'wallets')
          } = options
    if (!existsSync(state)) {
      options.state     = makeStateDir(state)
      options.nodeState = resolve(state, 'node.json')
      options.keysState = mkdir(state, 'wallets')
      return await this.spawn(options)
    }
    if (!existsSync(nodeState)) {
      touch(nodeState)
      return await this.spawn(options)
    }
    let restored
    try {
      restored = JSON.parse(await readFile(nodeState, 'utf8'))
    } catch (e) {
      console.warn(e)
      warn(`reading ${nodeState} failed, trying to spawn a new node...`)
      return this.spawn(options)
    }
    const { containerId
          , port } = restored
    const { dockerOptions = { socketPath: '/var/run/docker.sock' }
          , docker        = new Docker(dockerOptions) } = options
    let container, Running
    try {
      container = docker.getContainer(containerId)
      ;({State:{Running}} = await container.inspect())
    } catch (e) {
      warn(`getting container ${containerId} failed, trying to spawn a new node...`)
      return this.spawn(options)
    }
    if (!Running) await container.start({})
    process.on('beforeExit', async ()=>{
      const {State:{Running}} = await container.inspect()
      if (Running) {
        debug(`killing ${container.id}`)
        await container.kill()
        debug(`killed ${container.id}`)
        process.exit()
      }
    })
    // return interface to this node/node
    return new this({ state, nodeState, keysState
                    , chainId, container, port })
  }

  /**Configure a new localnet container
   */
  static async spawn (options={}) {
    debug('spawning a new localnet container...')
    const { chainId = "enigma-pub-testnet-3"
          // what port to listen on
          , port    = await freePort()
          // where to keep state
          , state       = makeStateDir(defaultDataDir(), 'fadroma', chainId)
          , nodeState   = touch(state, 'node.json')
          , keysState   = mkdir(state, 'wallets')
          , daemonState = mkdir(state, '.secretd')
          , cliState    = mkdir(state, '.secretcli')
          , sgxState    = mkdir(state, '.sgx-secrets')
          // get interface to docker daemon and fetch node image
          , dockerOptions = { socketPath: '/var/run/docker.sock' }
          , docker        = new Docker(dockerOptions)
          , image         = await pull("enigmampc/secret-network-sw-dev", docker)
          // modified genesis that keeps the keys
          , init = resolve(__dirname, 'init.sh')
          , genesisAccounts = ['ADMIN', 'ALICE', 'BOB', 'MALLORY']
          , containerOptions = // stuff dockerode passes to docker
            { Image: image
            , Entrypoint: [ '/bin/bash' ]
            , Cmd:        [ '/init.sh' ]
            , AttachStdin:  true
            , AttachStdout: true
            , AttachStderr: true
            , Tty:          true
            , Env: [ `Port=${port}`
                   , `ChainID=${chainId}`
                   , `GenesisAccounts=${genesisAccounts.join(' ')}` ]
            , HostConfig:
              { NetworkMode: 'host'
              , Binds: [ `${init}:/init.sh:ro`
                       , `${keysState}:/shared-keys:rw`
                       , `${daemonState}:/root/.secretd:rw`
                       , `${cliState}:/root/.secretcli:rw`
                       , `${sgxState}:/root/.sgx-secrets:rw` ] } }
          } = options
    // create container with the above options
    const container = await docker.createContainer(containerOptions)
    const {id} = container
    await container.start()
    // record its existence for subsequent runs
    const stored = { chainId, containerId: id, port }
    await writeFile(nodeState, JSON.stringify(stored, null, 2), 'utf8')
    // wait for logs to confirm that the genesis is done
    await waitUntilLogsSay(container, 'GENESIS COMPLETE')
    return new this({ state, keysState
                    , chainId, container, port })
  }
}
