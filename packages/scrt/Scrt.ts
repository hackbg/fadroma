export * from '@fadroma/ops'

import {
  Console, colors, bold,
  BaseAgent, Agent, Identity, AgentConstructor, Bundle, Bundled,
  BaseChain, ChainNode,
  DockerizedChainNode, ChainNodeOptions,
  BaseContract, Contract, ContractMessage,
  AugmentedContract, TransactionExecutor, QueryExecutor,
  Fees, BaseGas,
  waitUntilNextBlock, 
  Path, Directory, TextFile, JSONFile, JSONDirectory,
  readFile, execFile, spawn,
  dirname, fileURLToPath,
  toBase64
} from '@fadroma/ops'

const console = Console('@fadroma/scrt')

import { Bip39 } from '@cosmjs/crypto'
import {
  EnigmaUtils, Secp256k1Pen, SigningCosmWasmClient,
  encodeSecp256k1Pubkey, pubkeyToAddress,
  makeSignBytes, BroadcastMode
} from 'secretjs'
import type { MsgInstantiateContract, MsgExecuteContract } from 'secretjs/src/types'

export type APIConstructor = new(...args:any) => SigningCosmWasmClient
export type ScrtNodeConstructor = new (options?: ChainNodeOptions) => ChainNode

export const __dirname = dirname(fileURLToPath(import.meta.url))

export abstract class Scrt extends BaseChain {
  faucet = `https://faucet.secrettestnet.io/`
}

export abstract class DockerizedScrtNode extends DockerizedChainNode {
  /** This directory is mounted out of the localnet container
    * in order to persist the state of the SGX component. */
  readonly sgxDir: Directory
  protected setDirectories (stateRoot?: Path) {
    if (!this.chainId) {
      throw new Error('@fadroma/scrt: refusing to create directories for localnet with empty chain id')
    }
    stateRoot = stateRoot || resolve(process.cwd(), 'receipts', this.chainId)
    Object.assign(this, { stateRoot: new Directory(stateRoot) })
    Object.assign(this, {
      identities: this.stateRoot.subdir('identities', JSONDirectory),
      nodeState:  new JSONFile(stateRoot, 'node.json'),
      daemonDir:  this.stateRoot.subdir('_secretd'),
      clientDir:  this.stateRoot.subdir('_secretcli'),
      sgxDir:     this.stateRoot.subdir('_sgx-secrets')
    })
  }
  async spawn () {
    try {
      this.sgxDir.make()
    } catch (e) {
      console.warn(`Failed to create ${this.sgxDir.path}: ${e.message}`)
    }
    return await super.spawn()
  }
  get binds () {
    return {
      ...super.binds,
      //[this.sgxDir.path]:    '/root/.sgx-secrets:rw',
      //[this.daemonDir.path]: `/root/.secretd:rw`,
      //[this.clientDir.path]: `/root/.secretcli:rw`,
    }
  }
  abstract readonly chainId:    string
  abstract readonly image:      string
  abstract readonly initScript: TextFile
}

export function resetLocalnet ({ chain }: any) {
  return chain.node.terminate()
}

/** Uses `secretjs` to queries and transact
  * with a Secret Network chain endpoint. */
export abstract class ScrtAgentJS extends BaseAgent {
  /** Create a new agent from a signing pen. */
  constructor (options: Identity & { API: APIConstructor }) {
    super(options)
    this.chain    = options.chain as Scrt
    this.name     = options.name || ''
    this.keyPair  = options.keyPair
    this.mnemonic = options.mnemonic
    this.pen      = options.pen
    this.fees     = options.fees || defaultFees
    this.pubkey   = encodeSecp256k1Pubkey(options.pen.pubkey)
    this.address  = pubkeyToAddress(this.pubkey, 'secret')
    this.sign     = this.pen.sign.bind(this.pen)
    this.seed     = EnigmaUtils.GenerateNewSeed()
    this.API = new (options.API)(
      this.chain.url, this.address,
      this.sign, this.seed, this.fees,
      BroadcastMode.Sync
    )
  }

  /** Create a new agent with its signing pen, from a mnemonic or a keyPair.*/
  static async createSub (AgentClass: AgentConstructor, options: Identity): Promise<Agent> {
    const { name = 'Anonymous', ...args } = options
    let { mnemonic, keyPair } = options
    let info = ''
    if (mnemonic) {
      info = bold(`Creating SecretJS agent from mnemonic:`) + ` ${name} `
      // if keypair doesnt correspond to the mnemonic, delete the keypair
      if (keyPair && mnemonic !== (Bip39.encode(keyPair.privkey) as any).data) {
        console.warn(`ScrtAgentJS: Keypair doesn't match mnemonic, ignoring keypair`)
        keyPair = null
      }
    } else if (keyPair) {
      info = `ScrtAgentJS: generating mnemonic from keypair for agent ${bold(name)}`
      // if there's a keypair but no mnemonic, generate mnemonic from keyapir
      mnemonic = (Bip39.encode(keyPair.privkey) as any).data
    } else {
      info = `ScrtAgentJS: creating new SecretJS agent: ${bold(name)}`
      // if there is neither, generate a new keypair and corresponding mnemonic
      keyPair  = EnigmaUtils.GenerateNewKeyPair()
      mnemonic = (Bip39.encode(keyPair.privkey) as any).data
    }
    const pen  = await Secp256k1Pen.fromMnemonic(mnemonic)
    const agent = new AgentClass({name, mnemonic, keyPair, pen, ...args})
    return agent
  }

  readonly name:     string

  readonly chain:    Scrt
  fees = defaultFees

  readonly keyPair:  any
  readonly mnemonic: any
  readonly pen:      any
  readonly sign:     any
  readonly pubkey:   any
  readonly seed:     any
  readonly address:  string

  readonly API:      SigningCosmWasmClient
  get nextBlock () { return waitUntilNextBlock(this) }
  get block     () { return this.API.getBlock() }
  get account   () { return this.API.getAccount(this.address) }
  get balance   () { return this.getBalance('uscrt') }
  async getBalance (denomination: string) {
    const account = await this.account
    const balance = account.balance || []
    const inDenom = ({denom}) => denom === denomination
    const balanceInDenom = balance.filter(inDenom)[0]
    if (!balanceInDenom) return 0
    return balanceInDenom.amount
  }
  async send (recipient: any, amount: string|number, denom = 'uscrt', memo = "") {
    if (typeof amount === 'number') amount = String(amount)
    return await this.API.sendTokens(recipient, [{denom, amount}], memo)
  }
  async sendMany (txs = [], memo = "", denom = 'uscrt', fee = new ScrtGas(500000 * txs.length)) {
    if (txs.length < 0) {
      throw new Error('tried to send to 0 recipients')
    }
    const from_address = this.address
    //const {accountNumber, sequence} = await this.API.getNonce(from_address)
    let accountNumber: any
    let sequence:      any
    const msg = await Promise.all(txs.map(async ([to_address, amount])=>{
      ({accountNumber, sequence} = await this.API.getNonce(from_address)) // increment nonce?
      if (typeof amount === 'number') amount = String(amount)
      const value = {from_address, to_address, amount: [{denom, amount}]}
      return { type: 'cosmos-sdk/MsgSend', value }
    }))
    const signBytes = makeSignBytes(msg, fee, this.chain.id, memo, accountNumber, sequence)
    return this.API.postTx({ msg, memo, fee, signatures: [await this.sign(signBytes)] })
  }

  async upload (pathToBinary: string) {
    return await this.API.upload(await readFile(pathToBinary), {})
  }
  async getCodeHash (idOrAddr: number|string): Promise<string> {
    if (typeof idOrAddr === 'number') {
      return await this.API.getCodeHashByCodeId(idOrAddr)
    } else if (typeof idOrAddr === 'string') {
      return await this.API.getCodeHashByContractAddr(idOrAddr)
    } else {
      throw new TypeError('getCodeHash id or addr')
    }
  }

  async instantiate (contract: Contract, initMsg: any) {
    const from = this.address
    const { codeId, label } = contract
    this.traceCall(`${bold('INIT')}  ${codeId} ${label}`)
    const initTx = await this.API.instantiate(codeId, initMsg, label)
    Object.assign(initTx, { contractAddress: initTx.logs[0].events[0].attributes[4].value })
    return initTx
  }
  async getCodeId (address: string): Promise<number> {
    const { codeId } = await this.API.getContract(address)
    return codeId
  }
  async getLabel (address: string): Promise<string> {
    const { label } = await this.API.getContract(address)
    return label
  }

  async query (contract: Contract, msg: ContractMessage) {
    const { label, address, codeHash } = contract
    const from   = this.address
    const method = getMethod(msg)
    const N = this.traceCall(
      `${bold(colors.blue('QUERY'.padStart(5)))} ${bold(method.padEnd(20))} on ${contract.address} ${bold(contract.name||'???')}`,
      //{ msg }
    )
    const response = await this.API.queryContractSmart(address, msg as any, undefined, codeHash)
    this.traceResponse(N, /*{ response }*/)
    return response
  }
  async execute (contract: Contract, msg: ContractMessage, memo: any, amount: any, fee: any) {
    const { label, address, codeHash } = contract
    const from   = this.address
    const method = getMethod(msg)
    const N = this.traceCall(
      `${bold(colors.yellow('TX'.padStart(5)))} ${bold(method.padEnd(20))} on ${contract.address} ${bold(contract.name||'???')}`,
      //{ msg, memo, amount, fee }
    )
    const result = await this.API.execute(address, msg as any, memo, amount, fee, codeHash)
    this.traceResponse(N, /*{ result: result.transactionHash }*/)
    return result
  }

  async bundle (cb: Bundle<typeof this>): Promise<any> {
    const bundle = new ScrtAgentJSBundled(this)
    await bundle.populate(cb)
    return bundle.run()
  }

}

export class ScrtAgentJSBundled extends Bundled<ScrtAgentJS> {

  async execute (
    { address, codeHash }: Contract,
    handleMsg,
    transferAmount = []
  ): Promise<any> {
    return this.add({
      contractAddress: address,
      contractCodeHash: codeHash,
      handleMsg,
      transferAmount
    }, new Promise((resolve, reject)=>{}))
  }

  async run () {
    const N = this.executingAgent.traceCall(
      `${bold(colors.yellow('MULTI'.padStart(5)))} ${this.msgs.length} messages`,
    )
    const result = await this.executingAgent.API.multiExecute(this.msgs, "", {
      gas:    String(this.msgs.length*1000000),
      amount: [ { denom: 'uscrt', amount: String(this.msgs.length*1000000) } ]
    })
    this.executingAgent.traceResponse(N)
    return result
  }

}

export function getMethod (msg: ContractMessage) {
  if (typeof msg === 'string') {
    return msg
  } else {
    const keys = Object.keys(msg)
    if (keys.length !== 1) {
      throw new Error(
        `@fadroma/scrt: message must be either an object `+
        `with one root key, or a string. Found: ${keys}`
      )
    }
    return Object.keys(msg)[0]
  }
}

/** This agent uses `secretcli` to run the commands. */
export class ScrtCLIAgent extends BaseAgent {
  /** Create a new agent with its signing pen, from a mnemonic or a keyPair.*/
  static async create (options: Identity) {
    const { name = 'Anonymous', ...args } = options
    let { mnemonic, keyPair } = options
    if (mnemonic) {
      // if keypair doesnt correspond to the mnemonic, delete the keypair
      if (keyPair && mnemonic !== (Bip39.encode(keyPair.privkey) as any).data) {
        console.warn(`keypair doesn't match mnemonic, ignoring keypair`)
        keyPair = null
      }
    } else if (keyPair) {
      // if there's a keypair but no mnemonic, generate mnemonic from keyapir
      mnemonic = (Bip39.encode(keyPair.privkey) as any).data
    } else {
      // if there is neither, generate a new keypair and corresponding mnemonic
      keyPair  = EnigmaUtils.GenerateNewKeyPair()
      mnemonic = (Bip39.encode(keyPair.privkey) as any).data
    }
    return new ScrtCLIAgent({name, mnemonic, keyPair, ...args})
  }
  chain:         Scrt
  name:          string
  address:       string
  nameOrAddress: string
  fees:          any
  static Help = {
    NOT_A_TTY: "Input is not a TTY - can't interactively pick an identity",
    NO_KEYS_1: "Empty key list returned from secretcli. Retrying once...",
    NO_KEYS_2: "Still empty. To proceed, add your key to secretcli " +
               "(or set the mnemonic in the environment to use the SecretJS-based agent)"
  }
  static async pick () {
    if (!process.stdin.isTTY) {
      throw new Error(ScrtCLIAgent.Help.NOT_A_TTY) }
    let keys = (await secretcli('keys', 'list'))
    if (keys.length < 1) {
      console.warn(ScrtCLIAgent.Help.NO_KEYS_1)
      await tryToUnlockKeyring()
      keys = (await secretcli('keys', 'list'))
      if (keys.length < 1) console.warn(ScrtCLIAgent.Help.NO_KEYS_2)
    }
  }
  constructor (options: { name: string, address: string }) {
    super(options)
    const { name, address } = options
    this.name = name
    this.address = address
    this.nameOrAddress = this.name || this.address
  }
  get nextBlock () {
    return this.block.then(async T1=>{
      while (true) {
        await new Promise(ok=>setTimeout(ok, 1000))
        const T2 = (await this.block).sync_info.latest_block_height
        if (T2 > T1) return
      }
    })
  }
  get block () {
    return secretcli('status').then(({sync_info:{latest_block_height:T2}})=>T2)
  }
  get account () {
    return secretcli('q', 'account', this.nameOrAddress)
  }
  get balance () {
    return this.getBalance('uscrt')
  }
  async getBalance (denomination: string) {
    return ((await this.account).value.coins
      .filter((x:any)=>x.denom===denomination)[0]||{})
      .amount
  }
  async send (recipient: any, amount: any, denom = 'uscrt', memo = '') {
    throw new Error('not implemented')
  }
  async sendMany (txs = [], memo = '', denom = 'uscrt', fee) {
    throw new Error('not implemented')
  }
  async upload (pathToBinary: string) {
    return secretcli(
      'tx', 'compute', 'store',
      pathToBinary,
      '--from', this.nameOrAddress )
  }
  async instantiate (contract: Contract, message: any) {
    const { codeId, initMsg = message, label = '' } = contract
    contract.agent = this
    console.debug(`⭕`+bold('init'), { codeId, label, initMsg })
    const initTx = contract.initTx = await secretcli(
      'tx', 'compute', 'instantiate',
      codeId, JSON.stringify(initMsg),
      '--label', label,
      '--from', this.nameOrAddress)
    console.debug(`⭕`+bold('instantiated'), { codeId, label, initTx })
    contract.codeHash = await secretcli('q', 'compute', 'contract-hash', initTx.contractAddress)
    await contract.save()
    return contract
  }
  async query ({ label, address }, method='', args = undefined) {
    const msg = (args === undefined) ? method : { [method]: args }
    console.debug(`❔ `+bold('query'), { label, address, method, args })
    const response = await secretcli(
      'q', 'compute', 'query',
      address, JSON.stringify(msg))
    console.debug(`❔ `+bold('response'), { address, method, response })
    return response
  }
  async execute ({ label, address }, method='', args = undefined) {
    const msg = (args === undefined) ? method : { [method]: args }
    console.debug(`❗ `+bold('execute'), { label, address, method, args })
    const result = await secretcli(
      'tx', 'compute',
      address, JSON.stringify(msg),
      '--from', this.nameOrAddress)
    console.debug(`❗ `+bold('result'), { label, address, method, result })
    return result
  }
}

const secretcli = (...args: Array<string>): Promise<unknown> =>
  new Promise((resolve, reject)=>{
    execFile('secretcli', args, (err: Error, stdout: unknown) => {
      if (err) {
        reject(new Error(`could not execute secretcli: ${err.message}`))
      } else {
        resolve(JSON.parse(String(stdout)))
      }
    })
  })

const tryToUnlockKeyring = () => new Promise((resolve, reject)=>{
  console.warn("Pretending to add a key in order to refresh the keyring...")
  const unlock = spawn('secretcli', ['keys', 'add'])
  unlock.on('spawn', () => {
    unlock.on('close', resolve)
    setTimeout(()=>{ unlock.kill() }, 1000)
  })
  unlock.on('error', reject)
})

export enum TxType {
  Spend        = "spend",
  ContractInit = "contractInit",
  ContractCall = "contractCall",
}

export type UnsignedTX = {
  chain_id:       string
  account_number: string
  sequence:       string
  fee:            string
  msgs:           string
  memo:           string
}

/** This agent just collects unsigned txs
  * and dumps them in the end
  * to do via multisig. */
export abstract class ScrtAgentTX extends BaseAgent {
  account_number: number = 0
  sequence:       number = 0
  transactions:   UnsignedTX[] = []
  private pushTX (...msgs: (MsgInstantiateContract|MsgExecuteContract)[]) {
    const tx = {
      chain_id:       this.chain.id,
      account_number: String(this.account_number),
      sequence:       String(this.sequence),
      fee:            "1000000uscrt",
      memo:           "",
      msgs:           JSON.stringify(msgs)
    }
    this.transactions.push(tx)
    return tx
  }
  async instantiate (
    { codeId, codeHash, label },
    message,
    init_funds = []
  ): Promise<UnsignedTX> {
    const init_msg = toBase64(await EnigmaUtils.encrypt(codeHash, message))
    const type = "wasm/MsgInstantiateContract"
    return this.pushTX({ type, value: {
      sender:  this.address,
      code_id: String(codeId),
      label,
      init_msg,
      init_funds,
    } })
  }
  query (contract: Contract, message: ContractMessage): Promise<any> {
    throw new Error('ScrtAgentTX.query: not implemented')
  }
  async execute (
    { address, codeHash },
    message: ContractMessage,
    sent_funds = []
  ): Promise<UnsignedTX> {
    const msg  = toBase64(await EnigmaUtils.encrypt(codeHash, message))
    const type = "wasm/MsgExecuteContract"
    return this.pushTX({ type, value: {
      sender:   this.address,
      contract: address,
      msg,
      sent_funds,
    } })
  }
}

import { resolve } from '@hackbg/tools'
export const buildScript = resolve(__dirname, 'ScrtBuild.sh')

export class ScrtContract extends BaseContract {
  buildImage      = 'enigmampc/secret-contract-optimizer:latest'
  buildDockerfile = null
  buildScript     = null
}

export class AugmentedScrtContract<
  Executor extends TransactionExecutor,
  Querier  extends QueryExecutor
> extends AugmentedContract<Executor, Querier> {
  buildImage      = 'enigmampc/secret-contract-optimizer:latest'
  buildDockerfile = null
  buildScript     = null

  static Queries      = QueryExecutor
  static Transactions = TransactionExecutor
}

export { TransactionExecutor, QueryExecutor }

export class ScrtGas extends BaseGas {
  static denom = 'uscrt'
  //denom = ScrtGas.denom
  constructor (x: number) {
    super(x)
    this.amount.push({amount: String(x), denom: ScrtGas.denom})
  }
}

export const defaultFees: Fees = {
  upload: new ScrtGas(4000000),
  init:   new ScrtGas(1000000),
  exec:   new ScrtGas(1000000),
  send:   new ScrtGas( 500000),
}
