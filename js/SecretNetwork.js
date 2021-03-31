import Docker from 'dockerode'
import { Bip39 } from '@cosmjs/crypto'
import { EnigmaUtils, Secp256k1Pen, SigningCosmWasmClient, encodeSecp256k1Pubkey, pubkeyToAddress
       , makeSignBytes } from 'secretjs'

import say, { sayer, muted } from './say.js'
import { loadJSON, loadSchemas } from './schema.js'
import { freePort, waitPort } from './net.js'
import {
  mkdirp, readFile, readFileSync, writeFile, existsSync, stat,
  execFileSync, spawnSync, onExit, 
  fileURLToPath, resolve, dirname, basename, homedir
} from './sys.js'

export default class SecretNetwork {
  // `destination` can be:
  // * empty or "mainnet" (not implemented)
  // * "holodeck-2" (not implemented)
  // * host:port (not implemented)
  // * fs path to localnet
  static async connect (destination, callback) {
    let agent, builder
    if (this.isFSPath(destination)) {
      ({agent, builder} = await this.localnet(destination))
    } else {
      // TODO holodeck-2, mainnet
      throw new Error('not implemented')
    }
    if (callback) {
      return callback({agent, builder})
    } else {
      return {agent, builder}
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
    const {host, port} = node
    const chain = new this(host, port)
    await chain.ready
    const agent = await chain.agent({ name: 'ADMIN', ...node.genesisAccount('ADMIN') })
    const builder = localnet.builder()
    return {network, agent, builder}
  }
  // create instance bound to given REST API endpoint
  constructor (host, port) {
    Object.assign(this, { host, port })
    const ready = waitPort({ host, port })
    Object.defineProperty(this, 'ready', { get () { return ready } })
  }
  // create agent operating on the bound endpoint
  agent = (options={}) =>
    this.constructor.Agent.create({ url: this.url, ...options })
  // create builder operating on the bound endpoint
  builder = (options={}) =>
    this.constructor.Builder.create({ url: this.url, ...options })
  // manages lifecycle of docker container for localnet
  static Node = class SecretNetworkNode {
    // path to the custom init script that saves the genesis wallets
    static initScript =
      resolve(dirname(fileURLToPath(import.meta.url)), 'SecretNetwork.init.sh')
    // create a node
    static async spawn (stateRoot, options={}) {
      // name and storage paths for this node
      const { chain     = `fadroma-localnet`
            , stateDir  = resolve(stateRoot, chain)
            , keysDir   = resolve(stateDir, 'keys')
            , stateFile = resolve(stateDir, 'state.json')
            } = options
      // ensure storage directories exist
      await Promise.all([stateDir,keysDir].map(mkdirp))
      // get interface to docker daemon
      const { dockerOptions = { socketPath: '/var/run/docker.sock' }
            , docker        = new Docker(dockerOptions)
            } = options
      // if a localnet was already created
      if (existsSync(stateFile)) {
        const {id, port} = JSON.parse(await readFile(stateFile, 'utf8'))
        const container = docker.getContainer(id)
        // respawn container
        const {State:{Running}} = await container.inspect()
        if (!Running) {
          await container.start({})
          process.on('beforeExit', async ()=>{
            console.debug(`killing ${container.id}`)
            await container.kill()
            console.debug(`killed ${container.id}`)
          })
        }
        // return interface to this node/chain
        return new this({ chain, stateDir, keysDir, container, port })
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
                  , `ChainID=${chain}`
                  , `GenesisAccounts=(${genesisAccounts.join(' ')})` ]
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
        return new this({ chain, stateDir, keysDir, container, port })
      }
    }
    constructor (fields) {
      Object.assign(this, fields, { host: 'localhost' /* lol */ })
    }
    start = () => {
      console.debug(`starting localnet from ${this.stateDir} on ${this.host}:${this.port}...`)
      process.on('beforeExit', () => console.log(123))
      return this.container.start({})
    }
    genesisAccount = name =>
      loadJSON(resolve(this.keysDir, `${name}.json`))
  }
  // `Agent`: tells time, sends transactions, executes contracts;
  // operates on a particular chain.
  static Agent = class SecretNetworkAgent {
    static async create ({ name, keyPair, mnemonic }={}) {

    }
    // ways of creating authenticated clients
    static async fromKeyPair ({
      say     = muted(),
      name    = "",
      keyPair = EnigmaUtils.GenerateNewKeyPair(),
      ...args
    }={}) {
      const mnemonic = Bip39.encode(keyPair.privkey).data
      return await this.fromMnemonic({name, mnemonic, keyPair, say, ...args})
    }
    static async fromMnemonic ({
      say      = muted(),
      name     = "",
      mnemonic = process.env.MNEMONIC,
      keyPair, // optional
      ...args
    }={}) {
      const pen = await Secp256k1Pen.fromMnemonic(mnemonic)
      return new this({name, mnemonic, keyPair, say, pen, ...args})
    }
    // initial setup
    constructor ({
      URL,
      say  = muted(),
      name = "",
      pen,
      keyPair,
      mnemonic,
      fees = SecretNetwork.Gas.defaultFees,
    }) {
      Object.assign(this, {
        name, keyPair, pen, mnemonic, fees,
        say: say.tag(`@${name}`)
      })
      this.pubkey  = encodeSecp256k1Pubkey(this.pen.pubkey)
      this.address = pubkeyToAddress(this.pubkey, 'secret')
      this.seed    = EnigmaUtils.GenerateNewSeed()
      this.sign    = pen.sign.bind(pen)
      this.API     = new SigningCosmWasmClient(URL, this.address, this.sign, this.seed, this.fees)
      return this
    }
    // interact with the network:
    async status () {
      const {header:{time,height}} = await this.API.getBlock()
      return this.say.tag('status')({
        time,
        height,
        account: await this.API.getAccount(this.address)
      })
    }
    async account () {
      const account = JSON.parse(execFileSync('secretcli', [ 'query', 'account', this.address ]))
      return this.say.tag(`account`)(account)
    }
    async time () {
      const {header:{time,height}} = await this.API.getBlock()
      return this.say.tag('time')({time,height})
    }
    async waitForNextBlock () {
      const {header:{height}} = await this.API.getBlock()
      this.say('waiting for next block before continuing...')
      while (true) {
        await new Promise(ok=>setTimeout(ok, 1000))
        const now = await this.API.getBlock()
        if (now.header.height > height) break
      }
    }
    async send (recipient, amount, memo = "") {
      this.say.tag(' #send')({recipient, amount, memo})
      if (typeof amount === 'number') amount = String(amount)
      return await this.API.sendTokens(recipient, [{denom: 'uscrt', amount}], memo)
    }
    async sendMany (txs = [], memo = "") {
      this.say.tag(' #sendMany')({txs})
      const chainId = await this.API.getChainId()
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
      const bytes = makeSignBytes(msg, fee, chainId, memo, accountNumber, sequence)
      const signatures = [await this.sign(bytes)]
      const { logs, transactionHash } = await this.API.postTx({ msg, fee, memo, signatures })
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
        return say.tag(' #cached')(JSON.parse(await readFile(receipt, 'utf8')))
      }
      // if no receipt, upload anew
      say.tag('uploading')(binary)
      const result = await this.API.upload(await readFile(binary), {})
      say.tag('uploaded')(result)
      await writeFile(receipt, JSON.stringify(result), 'utf8')
      return result
    }
    async instantiate ({ // call init on a new instance
      codeId, data = {}, label = ''
    }) {
      let {contractAddress: address, logs} = await this.API.instantiate(codeId, data, label)
      const hash = await this.API.getCodeHashByContractAddr(address)
      //logs = logs.reduce((log, {key,value})=>Object.assign(log, {[key]:value}), {})
      return { codeId, label, address, hash, logs }
    }
    async query ({ name, address }, method='', args={}) {
      const say = this.say.tag(name).tag(`${method}?`)
      const response = await this.API.queryContractSmart(address, {[method]:say(args)})
      return say.tag('returned')(response)
    }
    async execute ({ name, address }, method='', args={}) {
      const say = this.say.tag(name).tag(`${method}!`)
      const response = await this.API.execute(address, {[method]:say(args)})
      response.logs = response.logs.reduce((log, {key,value})=>Object.assign(log, {[key]:value}), {})
      return say.tag('returned')(response)
    }
  }

  static Builder = class SecretNetworkBuilder {
    static buildWorkingTree = ({
      builder = 'hackbg/secret-contract-optimizer:latest',
      buildAs = 'root',
      repo,
      crate,
      outputDir,
      buildCommand = ['-c', getBuildCommand({crate, buildAs}).join(' && ')],
    } = {}) => new Docker()
      .run(builder
          , [crate, 'HEAD']
          , process.stdout
          , { Env: getBuildEnv()
            , Tty: true
            , AttachStdin: true
            , HostConfig:
              { Binds: [ `sienna_cache_worktree:/code/target`
                       , `cargo_cache_worktree:/usr/local/cargo/`
                       , `${outputDir}:/output:rw`
                       , `${repo}:/src:rw` ] } })
    static buildCommit = ({
      builder = 'hackbg/secret-contract-optimizer:latest',
      buildAs = 'root',
      origin,
      commit,
      crate,
      outputDir,
      buildCommand = ['-c', getBuildCommand({origin, commit, crate, buildAs}).join(' && ')],
    }={}) => new Docker()
      .run(builder
          , buildCommand
          , process.stdout
          , { Env: getBuildEnv()
            , Tty: true
            , AttachStdin: true
            , Entrypoint: '/bin/sh'
            , HostConfig:
              { Binds: [ `sienna_cache_${commit}:/code/target`
                       , `cargo_cache_${commit}:/usr/local/cargo/`
                       , `${outputDir}:/output:rw`
                       , `${resolve(homedir(), '.ssh')}:/root/.ssh:ro` ] } })
    constructor ({ say = muted(), outputDir, agent } = {}) {
      Object.assign(this, { say, agent, outputDir })
    }
    workspace = repo => ({
      repo,
      crate: crate => ({
        repo,
        crate,
        deploy: (Contract, initData) => this.deploy(Contract, initData, { repo, crate })
      })
    })
    async deploy (
      Contract,
      data = {},
      options = {}
    ) {
      const {
        repo,
        crate,
        commit = 'HEAD',
        output = resolve(this.outputDir, `${crate}@${commit}.wasm`),
        binary = await this.build({crate, repo, commit, output}),
        label  = `${+new Date()}-${basename(binary)}`,
        agent  = this.agent,
        upload = await this.upload(binary, agent),
        codeId = upload.codeId,
        say = muted()
      } = options
      return new Contract({codeId, agent, say}).init({label, data})
    }
    async build ({crate, repo, origin, commit, output}) {
      const say = this.say.tag(`build(${crate}@${commit})`)
      if (existsSync(output)) {
        say.tag('cached')(output) // TODO compare against checksums
      } else {
        say.tag('building')(output)
        const { outputDir } = this
        const [{Error:err, StatusCode:code}, container] =
          (commit && commit !== 'HEAD')
          ? await buildCommit({ origin, commit, crate, outputDir })
          : await buildWorkingTree({ repo, crate, outputDir })
        await container.remove()
        if (err) throw new Error(err)
        if (code !== 0) throw new Error(`build exited with status ${code}`)
        say.tag('built')(output)
      }
      return output
    }
    async upload (binary) {
      const say = this.say.tag(`upload(${basename(binary)})`)
      // check for past upload receipt
      const chainId = await this.agent.API.getChainId()
      const receipt = `${binary}.${chainId}.upload`
      say({receipt})
      if (existsSync(receipt)) {
        const result = JSON.parse(await readFile(receipt, 'utf8'))
        return say.tag('cached')(result)
      }
      // if no receipt, upload anew
      say.tag('uploading')(binary)
      const result = await this.agent.API.upload(await readFile(binary), {})
      say.tag('uploaded')(result)
      await writeFile(receipt, JSON.stringify(result), 'utf8')
      return result
    }
  }

  static Contract = class SecretNetworkContract {
    // create subclass with methods based on the schema
    // TODO validate schema and req/res arguments with `ajv` etc.
    static withSchema (schema={}) {
      return extendWithSchema(this, schema)
    }
    constructor ({codeId, agent, say=muted()}={}) {
      return Object.assign(this, {codeId, agent, say})
    }
    async init ({label, data}) {
      const {codeId} = this
      this.say.tag(`init(${codeId})`)({label, data})
      const {address, hash} = await this.agent.instantiate({codeId, label, data})
      Object.assign(this, { address, hash })
      this.say.tag(`ready`)({ address, hash })
      return this
    }
    async query (method = '', args = {}, agent = this.agent) {
      return await agent.query(this, method, args)
    }
    async execute (method = '', args = {}, agent = this.agent) {
      return await agent.execute(this, method, args)
    }
  }

  static Gas = Object.assign(gas, { defaultFees: {
    upload: gas(2000000),
    init:   gas( 500000),
    exec:   gas( 400000),
    send:   gas( 600000),
  } })

  // local testnet
  //const localnetRoot = resolve(dirname(fileURLToPath(import.meta.url)), 'localnet')
  //const localnet = new SecretNetwork.Node(localnetRoot)
  //localnet.run().then(console.log).then(prepare).then(deploy).then(test)
  // get mnemonic of admin wallet from file generated by localnet genesis
  //const {mnemonic} = loadJSON(`../integration/localnet/keys/ADMIN.json`, import.meta.url)
  // create agent wrapping the admin wallet (used to deploy and control the contracts)
  //const ADMIN = await SecretNetwork.Agent.fromMnemonic({ say, name: 'ADMIN', mnemonic })
  //const commit    = 'HEAD' // git ref
  //const buildRoot = fileURLToPath(new URL('../build', import.meta.url))
  //const outputDir = resolve(buildRoot, 'outputs')
  //const builder   = new SecretNetwork.Builder({ say: say.tag('builder'), outputDir, agent: ADMIN })
  //// proceed to the next stage with these handles:
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
