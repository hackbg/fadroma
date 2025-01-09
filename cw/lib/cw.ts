import { Core } from '../deps.ts'
import type { Tendermint } from '../deps.ts'
import { bold, timed } from '../deps.ts'
import type { Fee, Coin, Into, ChainId, ChainRef, Address, Hash } from '../deps.ts'
export class Error extends Core.Error {}
export class Console extends Core.Console {
  timed = (name: string, cb: () => Promise<unknown>) => {
    return timed(cb, (result) => this.debug(`${bold(name)}: ${result.elapsed}`))
  }
}
/** A code ID, identifying uploaded code on a chain. */
export type CodeId = string|number
/** The hash of a contract's code. */
export type CodeHash = string
/** A contract's full unique on-chain label. */
export type Label = string
/** A transaction message that can be sent to a contract. */
export type Message = string|number|boolean|Record<string, unknown>
/** Available CosmWasm API methods. */
export type Api = Tendermint.Api
/** Something that can fetch SourceCode from e.g. the filesystem, or a URL. */
export type SourceProvider = {
  fetchSource (source: string):              Promise<SourceCode>
  fetchSource (source: URL):                 Promise<SourceCode>
  fetchSource (source: Partial<SourceCode>): Promise<SourceCode>
}
export const fetchSource = () =>
  { throw new Error('todo!') }
/** The source code of a contract. */
export type SourceCode = {
  /** URL pointing to Git upstream containing the canonical source code. */
  readonly upstream?:  string|URL
  /** Pointer to the source commit. */
  readonly reference?: string
  /** Path to local checkout of the source code (with .git directory if sourceRef is set). */
  readonly checkout?:  string
  /** Whether the code contains uncommitted changes. */
  readonly modified?:  boolean
}
/** Something that can compile SourceCode into CompiledCode,
  * e.g. our containerized Rust toolchain. */
export type Compiler = {
  compile (source: string):                Promise<CompiledCode>
  compile (source: URL):                   Promise<CompiledCode>
  compile (source: Partial<CompiledCode>): Promise<CompiledCode>
}
export const compile = (code: SourceCode, ...args: unknown[]): Promise<CompiledCode> =>
  { throw new Error('todo!') }
/** A binary file somewhere. */
export type CompiledCode = Partial<SourceCode> & {
  /** Location of the compiled code. */
  readonly codePath?: string|URL
  /** The compiled code. */
  readonly codeData?: Uint8Array
  /** Checksum uniquely identifying the compiled code. */
  readonly codeHash?: CodeHash
}
/** Something that can upload CompiledCode to a Chain,
  * e.g. that Chain's respective Agent. */
export type Uploader = {
  upload (source: string):                Promise<UploadedCode>
  upload (source: URL):                   Promise<UploadedCode>
  upload (source: Uint8Array):            Promise<UploadedCode>
  upload (source: Partial<UploadedCode>): Promise<UploadedCode>

  /** Chain-specific implementation of code upload. */
  upload (parameters: {
    binary:       Uint8Array,
    reupload?:    boolean,
    uploadStore?: UploadStore,
    uploadFee?:   Fee
    uploadMemo?:  string
  }): Promise<Partial<UploadedCode & {
    chainId: ChainId,
    codeId:  CodeId
  }>>
}
/** A code upload to a given chain, represented by a code ID. */
export type UploadedCode = Partial<CompiledCode> & {
  readonly chain:     ChainRef
  /** Code ID representing the identity of the contract's code on a specific chain. */
  readonly codeId:    CodeId
  /** Signer of the upload transaction. */
  readonly uploadBy?: Address
  /** Hash to the upload transaction. */
  readonly uploadTx?: Hash
}
/** A Map that caches contract uploads, so that the same contract isn't uploaded multiple times. */
export type UploadStore = Map<CodeHash, UploadedCode>
/** Something that can instantiate UploadedCode to get a Contract instance,
  * e.g. that Chain's respective Agent. */
export type Instantiator = {
  instantiate (codeId: CodeId, label: Label, init: Message, send?: Coin[], fee?: Fee):
    Promise<Contract>
  instantiate (args: { codeId: CodeId, label: Label, init: Message, send?: Coin[], fee?: Fee }):
    Promise<Contract>
  instantiate (parameters: Partial<Contract> & {
    initMsg:   Into<Message>
    initFee?:  Fee
    initSend?: Coin[]
    initMemo?: string
  }):
    Promise<Contract & { address: Address }>
}
export const instantiate = (code: UploadedCode, ...args: unknown[]): Promise<Contract> =>
  { throw new Error('todo!') }
/** A contract instance on a given chain. */
export type Contract = Partial<UploadedCode> & {
  readonly initBy?: Address
  readonly address: Address
  readonly label:   string
}
/** Context for every deployment method. */
export type Deps = { log: Console }
export type ClientDeps = Deps & {
  query:   <T>(...args: unknown[])=>Promise<T>,
  execute: <T>(...args: unknown[])=>Promise<T>,
}
export type DeployApi =
  & (SourceProvider|undefined)
  & (Compiler|undefined)
  & Instantiator
  & Uploader
  & FetchCodeInfo
  & FetchCodeInstances
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

export type FetchCodeInfo = {
  fetchCodeInfo ():
    Promise<Record<CodeId, UploadedCode>>
  fetchCodeInfo (codeId: CodeId, options?: { parallel?: boolean }):
    Promise<UploadedCode>
  fetchCodeInfo (codeIds: [CodeId], options?: { parallel?: boolean }):
    Promise<Record<CodeId, UploadedCode>>
}
function zeroOrMore <T> (args?: (T|T[])[]): T[] {
  if (!args || args.length === 0) {
    return []
  } else if (args.length === 1) {
    if (args[0] instanceof Array) {
      return args[0]
    } else {
      return [args[0]]
    }
  } else {
    return args as T[]
  }
}
export type FetchCodeInfoImpl =
  (args?: {codeIds?: CodeId[], parallel?: boolean}) =>
    Promise<Record<CodeId, UploadedCode>>
export const fetchCodeInfo = (
  { log }: Deps, impl: FetchCodeInfoImpl, ...args: Parameters<FetchCodeInfo["fetchCodeInfo"]>|[]
) => log.timed('fetchCodeInfo', () => impl({
  codeIds: zeroOrMore(args[0]),
  parallel: args[1]?.parallel
}))

export type FetchCodeInstances = {
  fetchCodeInstances ():
    Promise<Record<Address, Contract>>
  fetchCodeInstances (codeId: CodeId):
    Promise<Record<Address, Contract>>
  fetchCodeInstances (codeIds: Iterable<CodeId>, options?: { parallel?: boolean }):
    Promise<Record<CodeId, Record<Address, Contract>>>
}
export type FetchCodeInstancesImpl =
  (args?: {codeIds?: CodeId[], parallel?: boolean}) =>
    Promise<Record<CodeId, Record<Address, Contract>>>
export const fetchCodeInstances = (
  { log }: Deps, impl: FetchCodeInstancesImpl,
  ...args: Parameters<FetchCodeInstances["fetchCodeInstances"]>[]
) => {
}

//export function fetchCodeInstances (
  //chain: Chain, ...args: Parameters<Chain["fetchCodeInstances"]>
//) {
    //let $C = Contract
    //let custom = false
    //if (typeof args[0] === 'function') {
      //$C = args.shift() as typeof Contract
      //custom = true
    //}
    //if (!args[0]) {
      //throw new Error('Invalid arguments')
    //}

    //if ((args[0] as any)[Symbol.iterator]) {
      //const result: Record<CodeId, Record<Address, Contract>> = {}
      //const codeIds: Record<CodeId, typeof $C> = {}
      //for (const codeId of args[0] as unknown as CodeId[]) {
        //codeIds[codeId] = $C
      //}
      //chain.log.debug(`Querying contracts with code ids ${Object.keys(codeIds).join(', ')}...`)
      //return timed(function doFetchCodeInstances () {
        //return chain.getConnection().fetchCodeInstancesImpl({ codeIds })
      //}, function afterFetchCodeInstances ({elapsed}) {
        //chain.log.debug(`Queried in ${elapsed}ms`)
      //})
    //}

    //if (typeof args[0] === 'object') {
      //if (custom) {
        //throw new Error('Invalid arguments')
      //}
      //const result: Record<CodeId, Record<Address, Contract>> = {}
      //chain.log.debug(`Querying contracts with code ids ${Object.keys(args[0]).join(', ')}...`)
      //const codeIds = args[0] as { [id: CodeId]: typeof Contract }
      //return timed(function doFetchCodeInstances () {
        //return chain.getConnection().fetchCodeInstancesImpl({ codeIds })
      //}, function afterFetchCodeInstances ({elapsed}) {
        //chain.log.debug(`Queried in ${elapsed}ms`)
      //})
    //}

    //if ((typeof args[0] === 'number')||(typeof args[0] === 'string')) {
      //const id = args[0]
      //chain.log.debug(`Querying contracts with code id ${id}...`)
      //const result = {}
      //return timed(function doFetchCodeInstances () {
        //return chain.getConnection().fetchCodeInstancesImpl({ codeIds: { [id]: $C } })
      //}, function afterFetchCodeInstances ({elapsed}) {
        //chain.log.debug(`Queried in ${elapsed}ms`)
      //})
    //}

    //throw new Error('Invalid arguments')
//}

  //fetchCodeInstances (codeIds: { [id: CodeId]: Contract }, options?: { parallel?: boolean }): Promise<{ [codeId in keyof typeof codeIds]:
    //Record<Address, InstanceType<typeof codeIds[codeId]>> }>
  //[>* Fetch all instances of a code ID. <]
  //fetchCodeInstances (
    //codeId: CodeId
  //): Promise<Record<Address, Contract>>
  //[>* Fetch all instances of a code ID, with custom client class. <]
  //fetchCodeInstances <C extends typeof Contract> (
    //Contract: C,
    //codeId: CodeId
  //): Promise<Record<Address, InstanceType<C>>>
  //[>* Fetch all instances of multple code IDs. <]
  //fetchCodeInstances (
    //codeIds:  Iterable<CodeId>,
    //options?: { parallel?: boolean }
  //): Promise<Record<CodeId, Record<Address, Contract>>>
  //[>* Fetch all instances of multple code IDs, with custom client class. <]
  //fetchCodeInstances <C extends typeof Contract> (
    //Contract: C,
    //codeIds:  Iterable<CodeId>,
    //options?: { parallel?: boolean }
  //): Promise<Record<CodeId, Record<Address, InstanceType<C>>>>
  //[>* Fetch all instances of multple code IDs, with multiple custom client classes. <]
  //fetchCodeInstances (
    //codeIds:  { [id: CodeId]: typeof Contract },
    //options?: { parallel?: boolean }
  //): Promise<{
    //[codeId in keyof typeof codeIds]: Record<Address, InstanceType<typeof codeIds[codeId]>>
  //}>
  //async fetchCodeInstances (...args: unknown[]): Promise<unknown> {
    //return fetchCodeInstances(this, ...args as Parameters<Chain["fetchCodeInstances"]>)
  //}
  //[>* Chain-specific implementation of fetchCodeInstances. <]
  //abstract fetchCodeInstancesImpl (parameters: {
    //codeIds:   { [id: CodeId]: typeof Contract },
    //parallel?: boolean
  //}): Promise<{
    //[codeId in keyof typeof parameters["codeIds"]]:
      //Record<Address, InstanceType<typeof parameters["codeIds"][codeId]>>
  //}>
//}
//export const upload = async ({ log, agent }: Deps,
  //code: string|URL|Uint8Array|Partial<CompiledCode>,
  //options?: Omit<Parameters<Api["upload"]>[0], 'binary'>,
//) => {
  //let template: Uint8Array
  //if (code instanceof Uint8Array) {
    //template = code
  //} else {
    //const { CompiledCode } = _$_HACK_$_
    //if (typeof code === 'string' || code instanceof URL) {
      //code = new CompiledCode({ codePath: code })
    //} else {
      //code = new CompiledCode(code)
    //}
    //const t0 = performance.now()
    //code = code as CompiledCode
    //template = await (code as any).fetch()
    //const t1 = performance.now() - t0
    //log.log(
      //`Fetched in`, `${bold((t1/1000).toFixed(6))}s: code hash`,
      //bold(code.codeHash), `(${bold(String(code.codeData?.length))} bytes`
    //)
  //}
  //log.debug(`Uploading ${bold((code as any).codeHash)}`)
  //const result = await timed(
    //() => agent.getConnection().uploadImpl({
      //...options,
      //binary: template
    //}),
    //({elapsed, result}: any) => log.debug(
      //`Uploaded in ${bold(elapsed)}:`,
      //`code with hash ${bold(result.codeHash)} as code id ${bold(String(result.codeId))}`,
    //))
  //return ({ ...template, ...result as any }) as UploadedCode & {
    //chainId: ChainId
    //codeId:  CodeId
  //}
//}


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
