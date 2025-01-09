import { bold, timed } from '../deps.ts'
import type { ChainId, ChainRef, Address, Hash, Method } from '../deps.ts'
import type { CodeHash, CodeId } from './cw.ts'
export type SourceProvider = { fetchSource: Method<typeof fetchSource> }
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
export type Compiler = { compile: Method<typeof compile> }
export type CompiledCode = Partial<SourceCode> & {
  /** Location of the compiled code. */
  readonly codePath?: string|URL
  /** The compiled code. */
  readonly codeData?: Uint8Array
  /** Checksum uniquely identifying the compiled code. */
  readonly codeHash?: CodeHash
}
export type Uploader = { upload: Method<typeof upload> }
export type UploadedCode = Partial<CompiledCode> & {
  readonly uploadBy?: Address
  readonly uploadTx?: Hash
  readonly chain:     ChainRef
  /** Code ID representing the identity of the contract's code on a specific chain. */
  readonly codeId:    CodeId
}
/** A Map caching contract uploads. */
export type UploadStore = Map<CodeHash, UploadedCode>
export type Instantiator = { instantiate: Method<typeof instantiate> }
export type Contract = Partial<UploadedCode> & {
  readonly initBy?: Address
  readonly address: Address
  readonly label:   string
}
export type DeployDeps = { log: Console }
export type DeployApi = Instantiator & Uploader & (Compiler|undefined) & (SourceProvider|undefined)

export const fetchSource = () =>
  { throw new Error('todo!') }
export const compile = (code: SourceCode, ...args: unknown[]): Promise<CompiledCode> =>
  { throw new Error('todo!') }
export const instantiate = (code: UploadedCode, ...args: unknown[]): Promise<Contract> =>
  { throw new Error('todo!') }
export const upload = async (
  { log }: DeployDeps,
  code: string|URL|Uint8Array|Partial<CompiledCode>,
  options?: Omit<Parameters<Api["upload"]>[0], 'binary'>,
) => {
  let template: Uint8Array
  if (code instanceof Uint8Array) {
    template = code
  } else {
    const { CompiledCode } = _$_HACK_$_
    if (typeof code === 'string' || code instanceof URL) {
      code = new CompiledCode({ codePath: code })
    } else {
      code = new CompiledCode(code)
    }
    const t0 = performance.now()
    code = code as CompiledCode
    template = await (code as any).fetch()
    const t1 = performance.now() - t0
    log.log(
      `Fetched in`, `${bold((t1/1000).toFixed(6))}s: code hash`,
      bold(code.codeHash), `(${bold(String(code.codeData?.length))} bytes`
    )
  }
  log.debug(`Uploading ${bold((code as any).codeHash)}`)
  const result = await timed(
    () => agent.getConnection().uploadImpl({
      ...options,
      binary: template
    }),
    ({elapsed, result}: any) => log.debug(
      `Uploaded in ${bold(elapsed)}:`,
      `code with hash ${bold(result.codeHash)} as code id ${bold(String(result.codeId))}`,
    ))
  return ({ ...template, ...result as any }) as UploadedCode & {
    chainId: ChainId
    codeId:  CodeId
  }
}
  //[>* Fetch info about all code IDs uploaded to the chain. <]
  //fetchCodeInfo ():
    //Promise<Record<CodeId, UploadedCode>>
  //[>* Fetch info about a single code ID. <]
  //fetchCodeInfo (codeId: CodeId, options?: { parallel?: boolean }):
    //Promise<UploadedCode>
  //[>* Fetch info about multiple code IDs. <]
  //fetchCodeInfo (codeIds: Iterable<CodeId>, options?: { parallel?: boolean }):
    //Promise<Record<CodeId, UploadedCode>>
  //fetchCodeInfo (...args: unknown[]): Promise<unknown> {
    //return fetchCodeInfo(this, ...args as Parameters<Chain["fetchCodeInfo"]>)
  //}
  //[>* Chain-specific implementation of fetchCodeInfo. <]
  //abstract fetchCodeInfoImpl (parameters?: {
    //codeIds?:  CodeId[]
    //parallel?: boolean
  //}): Promise<Record<CodeId, UploadedCode>>
export const fetchCodeInfo = async (
  { log }: Deps, ...args: Parameters<Api["fetchCodeInfo"]>|[]
) => {
  const connection = chain.getConnection()
  if (args.length === 0) {
    log.debug('Querying all codes...')
    return timed(
      connection.fetchCodeInfoImpl.bind(connection),
      ({ elapsed, result }) => log.debug(
        `Queried in ${bold(elapsed)}: all codes`
      ))
  }
  if (args.length === 1) {
    if (args[0] instanceof Array) {
      const codeIds = args[0] as Array<CodeId>
      const { parallel } = args[1] as { parallel?: boolean }
      log.debug(`Querying info about ${codeIds.length} code IDs...`)
      return timed(
        connection.fetchCodeInfoImpl.bind(connection, { codeIds, parallel }),
        ({ elapsed, result }) => log.debug(
          `Queried in ${bold(elapsed)}: info about ${codeIds.length} code IDs`
        ))
    } else {
      const codeIds = [args[0] as CodeId]
      const { parallel } = args[1] as { parallel?: boolean }
      log.debug(`Querying info about code id ${args[0]}...`)
      return timed(
        connection.fetchCodeInfoImpl.bind(connection, { codeIds, parallel }),
        ({ elapsed }) => log.debug(
          `Queried in ${bold(elapsed)}: info about code id ${codeIds[0]}`
        ))
    }
  } else {
    throw new Error('fetchCodeInfo takes 0 or 1 arguments')
  }
}






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
