/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Tendermint, Address, ChainRef, bold, timed } from '../deps.ts'
import type { CodeId, CodeHash, Message } from './cw.ts'
import type { UploadedCode } from './cwDeploy.ts'

export type Contract = Partial<UploadedCode> & {
  readonly initBy?: Address
  readonly address: Address
  readonly label:   string
}

export type ClientApi = {
  fetchContractInfo (address: Address): Promise<Contract>
  fetchContractInfo (addresses: Address[], options?: { parallel?: boolean }): Promise<Record<Address, Contract>>
  //fetchContractInfo (contracts: { [address: Address]: Contract }, options?: { parallel?: boolean }):
    //Promise<{ [address in keyof typeof contracts]: InstanceType<typeof contracts[address]> }>
  /** Execute a contract transaction. */
  execute <T> (parameters: {
    address:   Address
    codeHash?: string
    message:   Message
    execFee?:  Tendermint.Fee
    execSend?: Tendermint.Coin[]
    execMemo?: string
  }): Promise<T>
  /** Query a contract. */
  query <T> (parameters: {
    address:   Address
    codeHash?: string
    message:   Message
  }): Promise<T>
}

export type ClientDeps = {
  query:   <T>(...args: unknown[])=>Promise<T>,
  execute: <T>(...args: unknown[])=>Promise<T>,
}

//import {
  //Console, Logged, SHA256, assign, base16, bold, hideProperties, into, timestamp, timed
//} from '../Util.ts'
//import type {
  //Address, Agent, Chain, ChainId, CodeId, CodeHash, Connection, Into, Label, Message, Name,
  //Token, TxHash,
//} from '../../index.ts'
//import {
  //CompiledCode
//} from './Compile.ts'

//export class UploadStore extends Map<CodeHash, UploadedCode> {
  //log = new Console(this.constructor.name)

  //constructor () {
    //super()
  //}

  //override get (codeHash: CodeHash): UploadedCode|undefined {
    //return super.get(codeHash)
  //}

  //override set (codeHash: CodeHash, value: Partial<UploadedCode>): this {
    //if (!(value instanceof UploadedCode)) {
      //value = new UploadedCode(value)
    //}
    //if (value.codeHash && (value.codeHash !== codeHash)) {
      //throw new Error('tried to store upload under different code hash')
    //}
    //return super.set(codeHash, value as UploadedCode)
  //}
//}

//[>* Represents a contract's code, in binary form, uploaded to a given chain. <]
//export class UploadedCode {
  //[>* Code hash uniquely identifying the compiled code. <]
  //codeHash?:  CodeHash
  //[>* ID of chain on which this contract is uploaded. <]
  //chainId?:   ChainId
  //[>* Code ID representing the identity of the contract's code on a specific chain. <]
  //codeId?:    CodeId
  //[>* TXID of transaction that performed the upload. <]
  //uploadTx?:  TxHash
  //[>* address of agent that performed the upload. <]
  //uploadBy?:  Address
  //[>* address of agent that performed the upload. <]
  //uploadGas?: string|number

  //constructor (properties: Partial<UploadedCode> = {}) {
    //assign(this, properties, [
      //'codeHash', 'chainId', 'codeId', 'uploadTx', 'uploadBy', 'uploadGas',
    //])
  //}

  //get [Symbol.toStringTag] () {
    //return [
      //this.codeId   || 'no code id',
      //this.chainId  || 'no chain id',
      //this.codeHash || '(no code hash)'
    //].join('; ')
  //}

  //serialize (): {
    //codeHash?:     CodeHash
    //chainId?:      ChainId
    //codeId?:       CodeId
    //uploadTx?:     TxHash
    //uploadBy?:     Address
    //uploadGas?:    string|number
    //uploadInfo?:   string
    //[key: string]: unknown
  //} {
    //let { codeHash, chainId, codeId, uploadTx, uploadBy, uploadGas } = this
    //if ((typeof this.uploadBy === 'object')) {
      //uploadBy = (uploadBy as any).identity?.address
    //}
    //return { codeHash, chainId, codeId, uploadTx, uploadBy: uploadBy as string, uploadGas }
  //}

  //get canInstantiate (): boolean {
    //return !!(this.chainId && this.codeId)
  //}

  //get canInstantiateInfo (): string|undefined {
    //return (
      //(!this.chainId) ? "can't instantiate: no chain id" :
      //(!this.codeId)  ? "can't instantiate: no code id"  :
      //undefined
    //)
  //}
//}


/** The `CompiledCode` class has an alternate implementation for non-browser environments.
  * This is because Next.js tries to parse the dynamic `import('node:...')` calls used by
  * the `fetch` methods. (Which were made dynamic exactly to avoid such a dual-implementation
  * situation in the first place - but Next is smart and adds a problem where there isn't one.)
  * So, it defaults to the version that can only fetch from URL using the global fetch method;
  * but the non-browser entrypoint substitutes `CompiledCode` in `_$_HACK_$_` with the
  * version which can also load code from disk (`LocalCompiledCode`). Ugh. */
//export const _$_HACK_$_ = { CompiledCode: CompiledCode }

//
  //[>* Fetch a contract's details wrapped in a `Contract` instance. <]
  //fetchContractInfo (
    //address:   Address
  //): Promise<Contract>
  //[>* Fetch a contract's details wrapped in a custom class instance. <]
  //fetchContractInfo <T extends typeof Contract> (
    //Contract:  T,
    //address:   Address
  //): Promise<InstanceType<T>>
  //[>* Fetch multiple contracts' details wrapped in `Contract` instance. <]
  //fetchContractInfo (
    //addresses: Address[],
    //options?:  { parallel?: boolean }
  //): Promise<Record<Address, Contract>>
  //[>* Fetch multiple contracts' details wrapped in instances of a custom class. <]
  //fetchContractInfo <T extends typeof Contract> (
    //Contract:  T,
    //addresses: Address[],
    //options?:  { parallel?: boolean }
  //): Promise<Record<Address, InstanceType<T>>>
  //[>* Fetch multiple contracts' details, specifying a custom class for each. <]
  //fetchContractInfo (
    //contracts: { [address: Address]: typeof Contract },
    //options?:  { parallel?: boolean }
  //): Promise<{
    //[address in keyof typeof contracts]: InstanceType<typeof contracts[address]>
  //}>
  //async fetchContractInfo (...args: unknown[]): Promise<unknown> {
    //return fetchContractInfo(this, ...args as Parameters<Chain["fetchContractInfo"]>)
  //}
  //[>* Chain-specific implementation of fetchContractInfo. <]
  //abstract fetchContractInfoImpl (parameters: {
    //contracts: { [address: Address]: typeof Contract },
    //parallel?: boolean
  //}): Promise<Record<Address, Contract>>
  //[>* Call a given program's transaction method. <]
  //async execute <T> (
    //contract: Address|Partial<Contract>,
    //message:  Message,
    //options?: Omit<Parameters<SigningConnection["executeImpl"]>[0],
      //'address'|'codeHash'|'message'>
  //): Promise<T> {
    //return await execute(this, contract, message, options) as T
  //}
