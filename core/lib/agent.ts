
/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program. If not, see <http://www.gnu.org/licenses/>. **/
import type { Address, Uint128, ChainId, CodeId, Token, Message, Into } from '../index.ts'
//import { assign, Logged } from './Util.ts'
//import { Chain } from './Chain.ts'
//import { send } from './dlt/Bank.ts'
//import { CompiledCode } from './compute/Compile.ts'
//import { UploadedCode, UploadStore, upload } from './compute/Upload.ts'
//import { Contract, instantiate, execute } from './compute/Contract.ts'

/** A cryptographic identity. */
//export class Identity extends Logged {
  //constructor (
    //properties: ConstructorParameters<typeof Logged>[0] & Pick<Identity, 'name'|'address'> = {}
  //) {
    //super(properties)
    //assign(this, properties, ['name', 'address'])
  //}
  //[>* Display name. <]
  //name?: Address
  //[>* Address of account. <]
  //address?: Address
  //[>* Sign some data with the identity's private key. <]
  //sign (_: unknown): unknown {
    //throw new Error("can't sign: stub")
  //}
//}

/** Enables non-read-only transactions by binding an `Identity` to a `Connection`. */
//export abstract class Agent extends Logged {
  //constructor (
    //properties: ConstructorParameters<typeof Logged>[0]
      //& Pick<Agent, 'chain'|'identity'>
      //& Partial<Pick<Agent, 'fees'>>
  //) {
    //super()
    //this.chain    = properties.chain
    //this.identity = properties.identity
    //this.fees     = properties.fees
  //}
  //[>* The chain on which this agent operates. <]
  //chain:      Chain
  //[>* The identity that will sign the transactions. <]
  //identity:   Identity
  //[>* Default transaction fees. <]
  //fees?:      Token.FeeMap<'send'|'upload'|'init'|'exec'>
  //[>* Get a signing connection to the RPC endpoint. <]
  //abstract getConnection (): SigningConnection
  //[>* Construct a transaction batch that will be broadcast by this agent. <]
  //abstract batch (): Batchwasm-pack build --dev --target web && rm -v pkg/package.json pkg/.gitignore
  //[>* Return the address of this agent. <]
  //get address (): Address|undefined {
    //return this.identity?.address
  //}
  //fetchBalance (_tokens?: string[]|string): Promise<Record<string, Uint128>> {
    //throw new Error("unimplemented!")
  //}
  //[>* Send one or more kinds of native tokens to one or more recipients. <]
  //send (
    //outputs:  Record<Address, Record<string, Uint128>>,
    //options?: Omit<Parameters<SigningConnection["sendImpl"]>[0],
      //'outputs'>
  //): Promise<unknown> {
    //return send(this, outputs, options)
  //}
  //[>* Upload a contract's code, generating a new code id/hash pair. <]
  //upload (
    //code:     string|URL|Uint8Array|Partial<CompiledCode>,
    //options?: Omit<Parameters<SigningConnection["uploadImpl"]>[0],
      //'binary'>,
  //): Promise<UploadedCode & {
    //chainId: ChainId,
    //codeId:  CodeId
  //}> {
    //return upload(this, code, options)
  //}
  //[>* Instantiate a new program from a code id, label and init message. <]
  //instantiate (
    //contract: CodeId|Partial<UploadedCode>,
    //options:  Partial<Contract> & {
      //initMsg:   Into<Message>,
      //initSend?: Token.ICoin[]
    //}
  //): Promise<Contract & {
    //address: Address,
  //}> {
    //return instantiate(this, contract, options)
  //}
  //[>* Call a given program's transaction method. <]
  //async execute <T> (
    //contract: Address|Partial<Contract>,
    //message:  Message,
    //options?: Omit<Parameters<SigningConnection["executeImpl"]>[0],
      //'address'|'codeHash'|'message'>
  //): Promise<T> {
    //return await execute(this, contract, message, options) as T
  //}
//}

/** Extend this class and implement the abstract methods to add support for a new kind of chain. */
abstract class SigningConnection {
  constructor (properties: { chain: Chain, identity: Identity }) {
    this.#chain    = properties.chain
    this.#identity = properties.identity
  }
  #chain: Chain
  /** Chain to which this connection points. */
  get chain (): Chain {
    return this.#chain
  }
  get chainId (): ChainId {
    return this.chain.chainId
  }
  #identity: Identity
  get identity (): Identity {
    return this.#identity
  }
  get address (): Address {
    return this.identity.address!
  }
}

    //if ((this.identity && (this.identity.name||this.identity.address))) {
      //const identityColor = randomColor({ // address takes priority in determining color
        //luminosity: 'dark', seed: this.identity.address||this.identity.name
      //})
      //this.log.label += ' '
      //this.log.label += colors.bgHex(identityColor).whiteBright(
        //` ${this.identity.name||this.identity.address} `
      //)
    //}
    //if ((this.identity && (this.identity.name||this.identity.address))) {
      //let myTag = `${this.identity.name||this.identity.address}`
      //const myColor = randomColor({ luminosity: 'dark', seed: myTag })
      //myTag = colors.bgHex(myColor).whiteBright.bold(myTag)
      //tag = [tag, myTag].filter(Boolean).join(':')
    //}

/** Builder object for batched transactions. */
export class Batch extends Logged {
  constructor (
    properties: ConstructorParameters<typeof Logged>[0] & Pick<Batch, 'agent'>
  ) {
    super(properties)
    this.agent = properties.agent
  }

  /** The chain targeted by the batch. */
  get chain (): Chain {
    return this.agent.chain
  }

  /** The agent that will broadcast the batch. */
  agent: Agent

  /** Add an upload message to the batch. */
  upload (..._args: Parameters<Agent["upload"]>): this {
    this.log.warn('upload: stub (not implemented)')
    return this
  }
  /** Add an instantiate message to the batch. */
  instantiate (..._args: Parameters<Agent["instantiate"]>): this {
    this.log.warn('instantiate: stub (not implemented)')
    return this
  }
  /** Add an execute message to the batch. */
  execute (..._args: Parameters<Agent["execute"]>): this {
    this.log.warn('execute: stub (not implemented)')
    return this
  }
  /** Submit the batch. */
  async submit (..._args: unknown[]): Promise<unknown> {
    this.log.warn('submit: stub (not implemented)')
    return {}
  }
}

