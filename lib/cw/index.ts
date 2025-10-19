import { Core } from './deps.ts'
/** A CosmWasm error. */
export class Error extends Core.Error {}
/** A CosmWasm logger. */
export class Console extends Core.Console {}
export const fetchSource: FetchSource = (...args: unknown[]) =>
  { throw new Error('todo!') }
export const compile: Compile = (...args: unknown[]): Promise<CompiledCode> =>
  { throw new Error('todo!') }
export const upload = (...args: unknown[]): Promise<UploadedCode> =>
  { throw new Error('todo!') }
//export const upload = async ({ log, agent }: Context,
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
export const fetchCodeInfo = (
  { log }: Api, impl: FetchCodeInfoImpl, ...args: Parameters<FetchCodeInfo>|[]
) => log.timed('fetchCodeInfo', () => impl({
  codeIds: zeroOrMore(args[0]),
  parallel: args[1]?.parallel
}))
export const instantiate = (...args: unknown[]): Promise<Contract> =>
  { throw new Error('todo!') }
export const fetchCodeInstances = ({ log }: Api, impl: FetchCodeInstancesImpl, ...args: Parameters<FetchCodeInstances>[]) =>
  { throw new Error('todo!') }
//export const fetchCodeInstances = (
  //chain: Chain, ...args: Parameters<Chain["fetchCodeInstances"]>
//) =>  {
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

export const fetchContractInfo: FetchContractInfo = (...args: unknown[]) =>
  Error.TODO('cw fetchContractInfo')

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
