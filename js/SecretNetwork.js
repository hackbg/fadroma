import Docker from 'dockerode'
import { Bip39 } from '@cosmjs/crypto'
import { EnigmaUtils, Secp256k1Pen, SigningCosmWasmClient, encodeSecp256k1Pubkey, pubkeyToAddress
       , makeSignBytes } from 'secretjs'
import say, { sayer, muted } from './say.js'
import { loadJSON, loadSchemas } from './schema.js'
import { freePort, waitPort } from './net.js'
import { mkdirp, readFile, readFileSync, writeFile, existsSync, stat
       , execFileSync, spawnSync, onExit
       , fileURLToPath, resolve, dirname, basename, homedir } from './sys.js'
export default class SecretNetwork {
  // `destination` can be:
  // * empty or "mainnet" (not implemented)
  // * "testnet"
  // * host:port (not implemented)
  // * fs path to localnet
  static async connect (destination, callback) {

    let chain, agent, builder

    if (this.isFSPath(destination)) {
      ({chain, agent, builder} = await this.localnet(destination))

    } else if ("testnet" === destination) {
      const host = 'bootstrap.secrettestnet.io'
      const port = 80
      chain = new this('holodeck-2', host, port)
      await chain.ready
      // can't get balance from genesis accounts,
      // need to feed a real testnet wallet from https://faucet.secrettestnet.io/
      const address  = 'secret1vdf2hz5f2ygy0z7mesntmje8em5u7vxknyeygy'
      const mnemonic = "genius supply lecture echo follow that silly meadow used gym nerve together"
      agent = await chain.getAgent("ADMIN", { mnemonic, address })
      console.log(agent)
      builder = chain.getBuilder(agent)

    } else {
      // TODO mainnet
      throw new Error('not implemented')
    }

    if (callback) {
      return callback({chain, agent, builder})
    } else {
      return {chain, agent, builder}
    }
  }
  // used by `connect()` to determine if the destination is a filesystem path
  static isFSPath = x =>
    ['.','/','file://'].some(y=>x.startsWith(y))
  // run a node in a docker container
  // return a SecretNetwork instance bound to that node
  // with corresponding agent and builder
  static async localnet (stateRoot) {
    const { Node, Agent, Builder } = this
    if (stateRoot.startsWith('file://')) stateRoot = fileURLToPath(stateRoot)
    const stats = await stat(stateRoot)
    if (stats.isFile()) stateRoot = dirname(stateRoot)
    const node = await Node.spawn(resolve(stateRoot, '.localnet'))
    const {chainId, host, port} = node
    const chain = await (new this(chainId, host, port)).ready
    const agent = await chain.getAgent('ADMIN', node.genesisAccount('ADMIN'))
    return { chain, agent, builder: chain.getBuilder(agent) }
  }
  // create instance bound to given REST API endpoint
  constructor (id, host, port) {
    Object.assign(this, { id, host, port })
    const ready = waitPort({ host, port }).then(()=>this)
    Object.defineProperty(this, 'ready', { get () { return ready } })
  }
  // manages lifecycle of docker container for localnet
  static Node = class SecretNetworkNode {
    // path to the custom init script that saves the genesis wallets
    static initScript =
      resolve(dirname(fileURLToPath(import.meta.url)), 'SecretNetwork.init.sh')
    // create a node
    static async spawn (stateRoot, options={}) {
      // name and storage paths for this node
      const { chainId   = `fadroma-localnet`
            , stateDir  = resolve(stateRoot, chainId)
            , keysDir   = resolve(stateDir, 'keys')
            , stateFile = resolve(stateDir, 'state.json')
            } = options
      // ensure storage directories exist
      await Promise.all([stateDir,keysDir].map(x=>mkdirp(x, {mode:0o770})))
      // get interface to docker daemon
      const { dockerOptions = { socketPath: '/var/run/docker.sock' }
            , docker        = new Docker(dockerOptions)
            } = options
      // if a localnet was already created
      if (existsSync(stateFile)) {
        const {id, port} = JSON.parse(await readFile(stateFile, 'utf8'))
        const container = docker.getContainer(id)
        // respawn container
        process.on('beforeExit', async ()=>{
          console.debug(`killing ${container.id}`)
          await container.kill()
          console.debug(`killed ${container.id}`)
        })
        const {State:{Running}} = await container.inspect()
        if (!Running) await container.start({})
        // return interface to this node/chain
        return new this({ chainId, stateDir, keysDir, container, port })
      } else {
        // configure a new localnet container
        const { image = // the original
                  "enigmampc/secret-network-sw-dev"
              , port = // random port
                  await freePort()
              , init = // modified genesis that keeps the keys
                  this.initScript
              , genesisAccounts = // who gets an initial balance
                  ['ADMIN', 'ALICE', 'BOB', 'MALLORY']
              , containerOptions = // actual container options
                { Image: image
                , Entrypoint: [ '/bin/bash' ]
                , Cmd: [ '/init.sh' ]
                , AttachStdin:  true
                , AttachStdout: true
                , AttachStderr: true
                , Tty:          true
                , Env:
                  [ `Port=${port}`
                  , `ChainID=${chainId}`
                  , `GenesisAccounts=${genesisAccounts.join(' ')}` ]
                , HostConfig:
                  { NetworkMode: 'host'
                   , Binds:
                    [ `${init}:/init.sh:ro`
                    , `${keysDir}:/shared-keys:rw`
                    , `${resolve(stateDir, 'secretd')}:/root/.secretd:rw`
                    , `${resolve(stateDir, 'secretcli')}:/root/.secretcli:rw`
                    , `${resolve(stateDir, 'sgx-secrets')}:/root/.sgx-secrets:rw` ] } }
              } = options
        // create container with the above options
        const container = await docker.createContainer(containerOptions)
        const {id} = container
        // record its existence for subsequent runs
        await writeFile(stateFile, JSON.stringify({ id, port }, null, 2), 'utf8')
        return new this({ chainId, stateDir, keysDir, container, port })
      }
    }
    constructor (fields) {
      this.host = 'localhost'
      this.agents = {}
      Object.assign(this, { host: 'localhost' /* lol */ }, fields)
    }
    genesisAccount = name =>
      loadJSON(resolve(this.keysDir, `${name}.json`))
  }
  get url () { return `http://${this.host}:${this.port}` }
  // create agent operating on the current instance's endpoint
  getAgent = (name, options={}) =>
    this.constructor.Agent.create(name, { chain: this, ...options })
  // `Agent`: tells time, sends transactions, executes contracts;
  // operates on a particular chain.
  static Agent = class SecretNetworkAgent {
    static async create (name = 'Anonymous', { mnemonic, keyPair, ...args }={}) {
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
      chain, name = "", mnemonic, keyPair, pen,
      fees = SecretNetwork.Gas.defaultFees,
      say = muted()
    }) {
      const pubkey = encodeSecp256k1Pubkey(pen.pubkey)
      return Object.assign(this, {
        chain, name, keyPair, mnemonic, pen, pubkey, say,
        API: new SigningCosmWasmClient(
          chain.url,
          this.address = pubkeyToAddress(pubkey, 'secret'),
          this.sign = pen.sign.bind(pen),
          this.seed = EnigmaUtils.GenerateNewSeed(),
          this.fees = fees
        )
      })
    }
    // interact with the network:
    async status () {
      const {header:{time,height}} = await this.API.getBlock()
      const account = await this.API.getAccount(this.address)
      return { time, height, account }
    }
    async account () {
      const account = JSON.parse(execFileSync('secretcli', [ 'query', 'account', this.address ]))
      return account
    }
    async time () {
      const {header:{time,height}} = await this.API.getBlock()
      return {time, height}
    }
    async waitForNextBlock () {
      const {header:{height}} = await this.API.getBlock()
      //this.say('waiting for next block before continuing...')
      while (true) {
        await new Promise(ok=>setTimeout(ok, 1000))
        const now = await this.API.getBlock()
        if (now.header.height > height) break
      }
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
        await this.sign(makeSignBytes(msg, fee, this.chain.id, memo, accountNumber, sequence))
      ] })
    }
    async upload ({ // upload code blob to the chain
      say=this.say,
      binary
    }) {
      // resolve binary from build folder
      binary = resolve(__dirname, '../../../build/outputs', binary)
      // check for past upload receipt
      const receipt = `${binary}.${await this.API.getChainId()}.upload`
      if (existsSync(receipt)) {
        return say.tag('receipt-exists')(JSON.parse(await readFile(receipt, 'utf8')))
      }
      // if no receipt, upload anew:
      say.tag('uploading')(binary)
      const result = await this.API.upload(await readFile(binary), {})
      say.tag('uploaded')(result)
      // keep receip
      await writeFile(receipt, JSON.stringify(result), 'utf8')
      return result
    }
    async instantiate ({ codeId, initMsg = {}, label = '' }) { // call init on a new instance
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
  getBuilder = agent => new this.constructor.Builder({chain: this, agent})
  static Builder = class SecretNetworkBuilder {
    constructor (fields) { this.configure(fields) }
    configure = (fields={}) => Object.assign(this, fields)
    crate = crate => ({
      deploy: (Contract, initMsg) => this.deploy(Contract, initMsg, { crate })
    })
    async getUploadReceipt (workspace, crate, commit = 'HEAD') {
      // output filename contains crate name and git ref
      const output = resolve(this.outputDir, `${crate}@${commit}.wasm`)
      // if the output doesnt exist, built it now
      if (!existsSync(output)) this.build({workspace, crate, commit, output})
      // check for past upload receipt
      const receipt = `${output}.${this.chain.id}.upload`
      if (existsSync(receipt)) {
        // TODO compare hash in receipt with on-chain hash from codeid
        // and invalidate receipt if they don't match
        return JSON.parse(await readFile(receipt, 'utf8'))
      }
      // if no receipt, upload anew
      const result = await this.agent.API.upload(await readFile(binary), {})
      await writeFile(receipt, JSON.stringify(result), 'utf8')
      return result
    }
    async deploy (Contract, data = {}, options = {}) {
      const {
        workspace = this.workspace,
        crate,
        commit = 'HEAD',
        output = resolve(this.outputDir, `${crate}@${commit}.wasm`),
        binary = await this.build({crate, workspace, commit, output}),
        label  = `${+new Date()}-${basename(binary)}`,
        agent  = this.agent,
        upload = await this.upload(binary, agent),
        codeId = upload.codeId,
        say = muted()
      } = options
      return new Contract({codeId, agent, say}).init({label, data})
    }
    async upload (binary) {
      // check for past upload receipt
      const chainId = await this.agent.API.getChainId()
      const receipt = `${binary}.${chainId}.upload`
      if (existsSync(receipt)) {
        // TODO compare hash in receipt with on-chain hash from codeid
        // and invalidate receipt if they don't match
        return JSON.parse(await readFile(receipt, 'utf8'))
      }
      // if no receipt, upload anew
      const result = await this.agent.API.upload(await readFile(binary), {})
      await writeFile(receipt, JSON.stringify(result), 'utf8')
      return result
    }
    async build ({origin, workspace, crate, commit, output}) {
      //const say = this.say.tag(`build(${crate}@${commit})`)
      const { outputDir } = this
      const [{Error:err, StatusCode:code}, container] =
        (commit && commit !== 'HEAD')
        ? await this.buildCommit({ origin, commit, crate })
        : await this.buildWorkingTree({ workspace, crate })
      await container.remove()
      if (err) throw new Error(err)
      if (code !== 0) throw new Error(`build exited with status ${code}`)
      return output
    }
    buildWorkingTree = ({
      outputDir = this.outputDir,
      builder = this.buildImage,
      buildAs = this.buildUser,
      workspace, crate,
      buildCommand = ['-c', getBuildCommand({crate, buildAs}).join(' && ')],
    } = {}) => new Docker().run(builder, [crate, 'HEAD'], process.stdout,
      say.tag(builder)({ Env: getBuildEnv()
      , Tty: true
      , AttachStdin: true
      , HostConfig:
      { Binds: [ `sienna_cache_worktree:/code/target`
               , `cargo_cache_worktree:/usr/local/cargo/`
               , `${outputDir}:/output:rw`
               , `${workspace}:/src:rw` ] } }))
    buildCommit = ({
      outputDir = this.outputDir,
      builder = this.buildImage,
      buildAs = this.buildUser,
      origin, commit, crate,
      buildCommand = ['-c', getBuildCommand({origin, commit, crate, buildAs}).join(' && ')],
    }={}) => new Docker().run(builder, buildCommand, process.stdout,
      { Env: getBuildEnv()
      , Tty: true
      , AttachStdin: true
      , Entrypoint: '/bin/sh'
      , HostConfig:
      { Binds: [ `sienna_cache_${commit}:/code/target`
               , `cargo_cache_${commit}:/usr/local/cargo/`
               , `${outputDir}:/output:rw`
               , `${resolve(homedir(), '.ssh')}:/root/.ssh:ro` ] } })
  }

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

export const getBuildCommand = ({origin, commit, crate, buildAs}) => {
  let commands = [`mkdir -p /src && cd /src`]
  if (origin || commit) {
    commands = commands.concat(
      [ `git clone --recursive -n ${origin} .` // get the code
      , `git checkout ${commit}`               // checkout the expected commit
      , `git submodule update`                 // update submodules for that commit
      ])
  }
  commands = commands.concat(
    [ `chown -R ${buildAs} /src && ls`
    , `/entrypoint.sh ${crate} ${commit}`
    , `mv ${crate}.wasm /output/${crate}@${commit}.wasm`
    ])
  return commands
}

export const getBuildEnv = () =>
  [ 'CARGO_NET_GIT_FETCH_WITH_CLI=true'
  , 'CARGO_TERM_VERBOSE=true'
  , 'CARGO_HTTP_TIMEOUT=240' ]

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
