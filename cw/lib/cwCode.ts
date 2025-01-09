import { bold } from '../deps.ts'
export async function upload (agent: Agent, ...args: Parameters<Agent["upload"]>) {
  let [code, options] = args
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
    agent.log.log(
      `Fetched in`, `${bold((t1/1000).toFixed(6))}s: code hash`,
      bold(code.codeHash), `(${bold(String(code.codeData?.length))} bytes`
    )
  }
  agent.log.debug(`Uploading ${bold((code as any).codeHash)}`)
  const result = await timed(
    () => agent.getConnection().uploadImpl({
      ...options,
      binary: template
    }),
    ({elapsed, result}: any) => agent.log.debug(
      `Uploaded in ${bold(elapsed)}:`,
      `code with hash ${bold(result.codeHash)} as code id ${bold(String(result.codeId))}`,
    ))
  return new UploadedCode({
    ...template, ...result as any
  }) as UploadedCode & {
    chainId: ChainId
    codeId:  CodeId
  }
}
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

/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
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
export async function fetchCodeInfo (
  chain: Chain, ...args: Parameters<Chain["fetchCodeInfo"]>|[]
) {
  const connection = chain.getConnection()
  if (args.length === 0) {
    chain.log.debug('Querying all codes...')
    return timed(
      connection.fetchCodeInfoImpl.bind(connection),
      ({ elapsed, result }) => chain.log.debug(
        `Queried in ${bold(elapsed)}: all codes`
      ))
  }
  if (args.length === 1) {
    if (args[0] instanceof Array) {
      const codeIds = args[0] as Array<CodeId>
      const { parallel } = args[1] as { parallel?: boolean }
      chain.log.debug(`Querying info about ${codeIds.length} code IDs...`)
      return timed(
        connection.fetchCodeInfoImpl.bind(connection, { codeIds, parallel }),
        ({ elapsed, result }) => chain.log.debug(
          `Queried in ${bold(elapsed)}: info about ${codeIds.length} code IDs`
        ))
    } else {
      const codeIds = [args[0] as CodeId]
      const { parallel } = args[1] as { parallel?: boolean }
      chain.log.debug(`Querying info about code id ${args[0]}...`)
      return timed(
        connection.fetchCodeInfoImpl.bind(connection, { codeIds, parallel }),
        ({ elapsed }) => chain.log.debug(
          `Queried in ${bold(elapsed)}: info about code id ${codeIds[0]}`
        ))
    }
  } else {
    throw new Error('fetchCodeInfo takes 0 or 1 arguments')
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
