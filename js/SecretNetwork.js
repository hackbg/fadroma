import assert from 'assert'
import Docker from 'dockerode'
import { Bip39 } from '@cosmjs/crypto'
import { EnigmaUtils, Secp256k1Pen, SigningCosmWasmClient, encodeSecp256k1Pubkey, pubkeyToAddress
       , makeSignBytes } from 'secretjs'
import say, { sayer, muted } from './say.js'
import { loadJSON, loadSchemas } from './schema.js'
import { freePort, waitPort, pull, waitUntilLogsSay } from './net.js'
import { defaultDataDir, mkdir, touch, makeStateDir
       , resolve, dirname, basename
       , fileURLToPath, cwd, homedir
       , existsSync, readFile, writeFile, unlink } from './sys.js'

export default class SecretNetwork {
  // create instance bound to given REST API endpoint
  constructor ({
    chainId  = 'localnet',
    state    = makeStateDir(defaultDataDir(), 'fadroma', chainId),
    receipts = mkdir(state, 'uploaded'),
    host     = 'localhost',
    port     = 1337
  }) {
    Object.assign(this, { chainId, state, receipts, host, port })
  }
  get url () { return `http://${this.host}:${this.port}` }

  // run a node in a docker container
  // return a SecretNetwork instance bound to that node
  // with corresponding agent and builder
  static async localnet ({
    chainId   = 'enigma-pub-testnet-3',
    stateBase = resolve(defaultDataDir(), 'fadroma'),
    state     = makeStateDir(stateBase, chainId)
  }={}) {
    console.debug(`preparing localnet "${chainId}" @ ${state}`)
    const node = await this.Node.respawn({state, chainId})
    await node.ready
    console.debug(`localnet ready @ ${node.state}`)
    const {host, port} = node
    const network = new this({chainId, host, port})
    const agent = await network.getAgent('ADMIN', node.genesisAccount('ADMIN'))
    return { node, network, agent, builder: network.getBuilder(agent) }
  }

  static async testnet ({
    host     = 'bootstrap.secrettestnet.io',
    port     = 80,
    // can't get balance from genesis accounts -
    // needs a real testnet wallet - load it from https://faucet.secrettestnet.io/
    // TODO automate this
    address  = 'secret1vdf2hz5f2ygy0z7mesntmje8em5u7vxknyeygy',
    mnemonic = 'genius supply lecture echo follow that silly meadow used gym nerve together'
  }={}) {
    const network = new this('holodeck-2', host, port)
    await network.ready
    const agent = await network.getAgent("ADMIN", { mnemonic, address })
    return { network, agent, builder: network.getBuilder(agent) }
  }

  static async mainnet () {
    throw new Error('not implemented')
  }

  // manage lifecycle of docker container for localnet
  static Node = class SecretNetworkNode {
    // wake up a stopped localnet container, or create one
    static async respawn (options={}) {
      // chain id and storage paths for this node
      const { chainId   = 'enigma-pub-testnet-3'
            , state     = makeStateDir(defaultDataDir(), 'fadroma', chainId)
            , nodeState = resolve(state, 'node.json')
            , keysState = mkdir(state, 'keys')
            } = options
      if (!existsSync(state)) {
        options.state     = makeStateDir(state)
        options.nodeState = resolve(state, 'node.json')
        options.keysState = mkdir(state, 'keys')
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
        console.warn(`reading ${nodeState} failed, trying to spawn a new node...`)
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
        console.warn(`getting container ${containerId} failed, trying to spawn a new node...`)
        return this.spawn(options)
      }
      if (!Running) await container.start({})
      process.on('beforeExit', async ()=>{
        const {State:{Running}} = await container.inspect()
        if (Running) {
          console.debug(`killing ${container.id}`)
          await container.kill()
          console.debug(`killed ${container.id}`)
          process.exit()
        }
      })
      // return interface to this node/node
      return new this({ state, nodeState, keysState, chainId, container, port })
    }
    // configure a new localnet container:
    static async spawn (options={}) {
      console.debug('spawning a new localnet container...')
      const { chainId = "enigma-pub-testnet-3"
            // what port to listen on
            , port    = await freePort()
            // where to keep state
            , state       = makeStateDir(defaultDataDir(), 'fadroma', chainId)
            , nodeState   = touch(state, 'node.json')
            , keysState   = mkdir(state, 'keys')
            , daemonState = mkdir(state, '.secretd')
            , cliState    = mkdir(state, '.secretcli')
            , sgxState    = mkdir(state, '.sgx-secrets')
            // get interface to docker daemon and fetch node image
            , dockerOptions = { socketPath: '/var/run/docker.sock' }
            , docker        = new Docker(dockerOptions)
            , image         = await pull("enigmampc/secret-network-sw-dev", docker)
            // modified genesis that keeps the keys
            , init = resolve(dirname(fileURLToPath(import.meta.url)), 'SecretNetwork.init.sh')  
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
      return new this({ chainId, state, keysState, container, port })
    }
    constructor (options) {
      const defaults = { chainId: 'enigma-pub-testnet-3'
                       , host:    'localhost'
                       , port:    1337 }
      Object.assign(this, defaults, options)

      const ready = waitPort({ host: this.host, port: this.port }).then(()=>this)
      Object.defineProperty(this, 'ready', { get () { return ready } })
    }
    genesisAccount = name =>
      loadJSON(resolve(this.keysState, `${name}.json`))
  }
  get url () { return `http://${this.host}:${this.port}` }
  // create agent operating on the current instance's endpoint
  // > observation: simpification of subsequent API layers reified
  // > as changing individual named args to positional + remaining options
  // > to wrap this up, remove unnecessary override channels via stacked options
  getAgent = (name, options={}) =>
    this.constructor.Agent.create({ ...options, network: this, name })
  // `Agent`: tells time, sends transactions, executes contracts;
  // operates on a particular node.
  static Agent = class SecretNetworkAgent {
    static async create ({ name = 'Anonymous', mnemonic, keyPair, ...args }={}) {
      if (mnemonic) {
        // if keypair doesnt correspond to the same mnemonic, delete the keypair
        if (keyPair && mnemonic !== Bip39.encode(keyPair.privkey).data) keyPair = null
      } else if (keyPair) {
        // if there's a keypair but no mnemonic, generate mnemonic from keyapir
        mnemonic = Bip39.encode(keyPair.privkey).data
      } else {
        // if there isn't either, generate a new keypair and corresponding mnemonic
        keyPair = EnigmaUtils.GenerateNewKeyPair()
        mnemonic = Bip39.encode(keyPair.privkey).data
      }
      const pen = await Secp256k1Pen.fromMnemonic(mnemonic)
      return new this({name, mnemonic, keyPair, say, pen, ...args})
    }
    // initial setup
    constructor ({
      network, name = "", mnemonic, keyPair, pen, fees = SecretNetwork.Gas.defaultFees,
    }) {
      const pubkey = encodeSecp256k1Pubkey(pen.pubkey)
      return Object.assign(this, {
        network, name, keyPair, mnemonic, pen, pubkey,
        API: new SigningCosmWasmClient(
          network.url,
          this.address = pubkeyToAddress(pubkey, 'secret'),
          this.sign = pen.sign.bind(pen),
          this.seed = EnigmaUtils.GenerateNewSeed(),
          this.fees = fees
        )
      })
    }
    // interact with the network:
    async status () {
      const [block, account] = await Promise.all([
        this.API.getBlock(),
        this.API.getAccount(this.address)
      ])
      const {header:{time,height}} = block 
      return { time, height, account }
    }
    get nextBlock () {
      return this.API.getBlock().then(({header:{height}})=>new Promise(async resolve=>{
        while (true) {
          await new Promise(ok=>setTimeout(ok, 1000))
          const now = await this.API.getBlock()
          if (now.header.height > height) {
            resolve()
            break
          }
        }
      }))
    }
    async send (recipient, amount, memo = "") {
      if (typeof amount === 'number') amount = String(amount)
      return await this.API.sendTokens(recipient, [{denom: 'uscrt', amount}], memo)
    }
    async sendMany (txs = [], memo = "") {
      const from_address = this.address
      const {accountNumber, sequence} = await this.API.getNonce(from_address)
      const msg = []
      for (let [ to_address, amount ] of txs) {
        const {accountNumber, sequence} = await this.API.getNonce(from_address)
        if (typeof amount === 'number') amount = String(amount)
        const value = {from_address, to_address, amount: [{denom: 'uscrt', amount}]}
        msg.push({ type: 'cosmos-sdk/MsgSend', value })
      }
      const fee = this.fees.send
      return this.API.postTx({ msg, memo, fee, signatures: [
        await this.sign(makeSignBytes(msg, fee, this.network.id, memo, accountNumber, sequence))
      ] })
    }
    // upload code blob to the chain
    async upload (pathToBinary) {
      return this.API.upload(await readFile(pathToBinary), {})
    }
    // call init on a new instance
    async instantiate ({ codeId, initMsg = {}, label = '' }) {
      const initTx = await this.API.instantiate(codeId, initMsg, label)
      const codeHash = await this.API.getCodeHashByContractAddr(initTx.contractAddress)
      return { ...initTx, codeId, label, codeHash }
    }
    query = (contract, method='', args={}) =>
      this.API.queryContractSmart(contract.address, {[method]: args})
    execute = (contract, method='', args={}) =>
      this.API.execute(contract.address, {[method]: args})
  }

  // create builder operating on the current instance's endpoint
  getBuilder = agent => new this.constructor.Builder({network: this, agent})
  static Builder = class SecretNetworkBuilder {
    constructor (fields) { this.configure(fields) }
    configure = (fields={}) => { Object.assign(this, fields) }
    async build (options) {
      const docker       = new Docker()
      const buildImage   = await pull('enigmampc/secret-contract-optimizer:latest', docker)
      const buildCommand = this.getBuildCommand(options)
      const entrypoint   = resolve(dirname(fileURLToPath(import.meta.url)), 'SecretNetwork.build.sh')
      const buildOptions = {
        Env: this.getBuildEnv(),
        Tty: true,
        AttachStdin: true,
        Entrypoint: ['/bin/sh', '-c'],
        HostConfig: {
          Binds: [
            `${entrypoint}:/entrypoint.sh:ro`,
            `${options.outputDir}:/output:rw`,
            `sienna_cache_${options.ref||'HEAD'}:/code/target:rw`,
            `cargo_cache_${options.ref||'HEAD'}:/usr/local/cargo:rw`,
          ]
        }
      }
      options.ref = options.ref || 'HEAD'
      if (options.ref === 'HEAD') { // when building working tree
        console.debug(`building working tree at ${options.workspace} into ${options.outputDir}...`)
        buildOptions.HostConfig.Binds.push(`${options.workspace}:/contract:rw`)
      }
      const args = [buildImage, buildCommand, process.stdout, buildOptions]
      const [{Error:err, StatusCode:code}, container] = await docker.run(...args)
      await container.remove()
      if (err) throw new Error(err)
      if (code !== 0) throw new Error(`build exited with status ${code}`)
      return resolve(options.outputDir, `${options.crate}@${options.ref}.wasm`)
    }
    getBuildCommand ({
      buildAs = 'root',
      origin  = 'git@github.com:hackbg/sienna-secret-token.git',
      ref     = 'HEAD',
      crate,
    }) {
      const commands = []
      if (ref !== 'HEAD') {
        assert(origin && ref, 'to build a ref from origin, specify both')
        console.debug('building ref from origin...')
        commands.push('mkdir -p /contract')
        commands.push('cd /contract')
        commands.push(`git clone --recursive -n ${origin} .`) // clone the repo with submodules
        commands.push(`git checkout ${ref}`) // check out the interesting ref
        commands.push(`git submodule update`) // update submodules for the new checkout
        //commands.push(`chown -R ${buildAs} /contract`)
      }
      commands.push(`bash /entrypoint.sh ${crate} ${ref||''}`)
      //commands.push(`pwd && ls -al && mv ${crate}.wasm /output/${crate}@${ref}.wasm`)
      return commands.join(' && ')
    }
    getBuildEnv = () =>
      [ 'CARGO_NET_GIT_FETCH_WITH_CLI=true'
      , 'CARGO_TERM_VERBOSE=true'
      , 'CARGO_HTTP_TIMEOUT=240' ]

    deployFromCrate = (workspace, crate) => {}
    crate = crate => ({
      deploy: (Contract, initMsg) => this.deploy(Contract, initMsg, { crate })
    })
    getReceiptPath = path =>
      resolve(this.network.receipts, `${basename(path)}.upload.json`)
    async uploadCached (artifact) {
      const receiptPath = this.getReceiptPath(artifact)
      if (existsSync(receiptPath)) {
        const receiptData = await readFile(receiptPath, 'utf8')
        return JSON.parse(receiptData)
      } else {
        return this.upload(artifact)
      }
    }
    async upload (artifact) {
      const uploadResult = await this.agent.upload(artifact)
      const receiptData  = JSON.stringify(uploadResult, null, 2)
      await writeFile(this.getReceiptPath(artifact), receiptData, 'utf8')
      return uploadResult
    }
  }

  // Interface to a contract instance
  // Can be subclassed with schema to auto-generate methods
  // TODO connect to existing contract
  static Contract = class SecretNetworkContract {

    // create subclass with methods based on the schema
    // TODO validate schema and req/res arguments with `ajv` etc.
    static withSchema = (schema={}) =>
      extendWithSchema(this, schema)

    constructor (fields={}) { return Object.assign(this, fields) }

    async init ({
      agent   = this.agent,
      codeId  = this.codeId,
      label   = this.label,
      initMsg = this.initMsg,
    } = {}) {
      const initTx = await agent.instantiate({codeId, label, initMsg})
      const {contractAddress: address, codeHash} = initTx
      Object.assign(this, { address, codeHash })
      return initTx.transactionHash
    }

    query = (method = '', args = {}, agent = this.agent) =>
      agent.query(this, method, args)

    execute = (method = '', args = {}, agent = this.agent) =>
      agent.execute(this, method, args)
  }

  static Gas = Object.assign(gas, { defaultFees: {
    upload: gas(2000000),
    init:   gas( 500000),
    exec:   gas( 400000),
    send:   gas( 500000),
  } })

}

// extend SecretNetworkContract
function extendWithSchema (SecretNetworkContract, schema) {

  return class SecretNetworkContractWithSchema extends SecretNetworkContract {
    // read-only: the parsed schema
    static get schema () { return schema }
    // read-only: the queries generated from the schema
    get q () {
      return methodsFromSchema(this, this.constructor.schema.queryMsg, (self, method) => ({
        async [method] (args, agent = self.agent) { return await self.query(method, args, agent) }
      }))
    }
    // read-only: the transactions generated from the schema
    get tx () {
      return methodsFromSchema(this, this.constructor.schema.handleMsg, (self, method) => ({
        async [method] (args, agent = self.agent) { return await self.execute(method, args, agent) }
      }))
    }
  }

  // TODO: memoize this, so that methods aren't regenerated until the schema updates
  // TODO: generate TypeScript types from autogenerated method lists and/or from schema
  function methodsFromSchema (self, schema, getWrappedMethod) {
    if (!schema) return null
    return schema.anyOf.reduce((methods, methodSchema)=>{
      const {description, required:[methodName]} = methodSchema
      const methodWrapper = getWrappedMethod(self, methodName)
      methodWrapper[methodName].description = description
      methodWrapper[methodName] = methodWrapper[methodName].bind(self)
      return Object.assign(methods, methodWrapper)
    }, {})
  }

}

function gas (x) {
  return {amount:[{amount:String(x),denom:'uscrt'}], gas:String(x)}
}
