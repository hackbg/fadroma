import type { Address, Hash, Chain } from '../deps.ts'

/** A contract's full unique on-chain label. */
export type ContractLabel = string

/** A code ID, identifying uploaded code on a chain. */
export type CodeId = string|number

/** The hash of a contract's code. */
export type CodeHash = string

/** A transaction message that can be sent to a contract. */
export type Message = string|Record<string, unknown>

export type ContractAddress = Address

export type ContractCodeId = CodeId
 
export type ContractCodeHash = CodeHash

export type Deps = {
  query:   <T>(...args: unknown[])=>Promise<T>,
  execute: <T>(...args: unknown[])=>Promise<T>,
}

export interface SourceProvider {
  fetchSource (...args: unknown[]): Promise<SourceCode>
}

export interface SourceCode {
  /** URL pointing to Git upstream containing the canonical source code. */
  readonly upstream?:  string|URL
  /** Pointer to the source commit. */
  readonly reference?: string
  /** Path to local checkout of the source code (with .git directory if sourceRef is set). */
  readonly checkout?:  string
  /** Whether the code contains uncommitted changes. */
  readonly modified?:  boolean
}

export interface Compiler {
  compile (source: SourceCode, ...args: unknown[]): Promise<CompiledCode>
}

export interface CompiledCode extends Partial<SourceCode> {
  /** Location of the compiled code. */
  readonly codePath?: string|URL
  /** The compiled code. */
  readonly codeData?: Uint8Array
  /** Checksum uniquely identifying the compiled code. */
  readonly codeHash?: ContractCodeHash
}

export interface Uploader {
  upload (code: CompiledCode, ...args: unknown[]): Promise<UploadedCode>
}

export interface UploadedCode extends Partial<CompiledCode> {
  readonly uploadBy?: Address
  readonly uploadTx?: Hash
  readonly chain:     Chain
  /** Code ID representing the identity of the contract's code on a specific chain. */
  readonly codeId:    ContractCodeId
}

export interface Instantiator {
  instantiate (code: UploadedCode, ...args: unknown[]): Promise<Contract>
}

export interface Contract extends Partial<UploadedCode> {
  readonly initBy?: Address
  readonly address: ContractAddress
  readonly label:   string
}

export type ContractConstructor<C extends Contract> = (...args: unknown[]) => C|Promise<C>

export type ContractMessage = string|number|boolean|object

export interface CosmWasmChainApi extends ChainApi {
  fetchCodeInfo ():
    Promise<Record<CodeId, UploadedCode>>
  fetchCodeInfo (codeId: CodeId, options?: { parallel?: boolean }):
    Promise<UploadedCode>
  fetchCodeInfo (codeIds: Iterable<CodeId>, options?: { parallel?: boolean }):
    Promise<Record<CodeId, UploadedCode>>

  fetchCodeInstances (codeId: CodeId):
    Promise<Record<ContractAddress, Contract>>
  fetchCodeInstances <C extends Contract> (Contract: ContractConstructor<C>, codeId: CodeId):
    Promise<Record<ContractAddress, C>>
  fetchCodeInstances (codeIds:  Iterable<CodeId>, options?: { parallel?: boolean }):
    Promise<Record<CodeId, Record<ContractAddress, Contract>>>
  fetchCodeInstances <C extends Contract> (Contract: C, codeIds:  Iterable<CodeId>, options?: { parallel?: boolean }):
    Promise<Record<CodeId, Record<ContractAddress, C>>>
  fetchCodeInstances (codeIds: { [id: CodeId]: typeof Contract }, options?: { parallel?: boolean }): Promise<{ [codeId in keyof typeof codeIds]:
    Record<ContractAddress, InstanceType<typeof codeIds[codeId]>> }>

  fetchContractInfo (address: ContractAddress):
    Promise<Contract>
  fetchContractInfo <T extends Contract> (Contract: ContractConstructor<T>, address: ContractAddress):
    Promise<T>
  fetchContractInfo (addresses: ContractAddress[], options?: { parallel?: boolean }):
    Promise<Record<ContractAddress, Contract>>
  fetchContractInfo <T extends Contract> (Contract: T, addresses: ContractAddress[], options?:  { parallel?: boolean }):
    Promise<Record<ContractAddress, T>>
  fetchContractInfo (contracts: { [address: ContractAddress]: typeof Contract }, options?: { parallel?: boolean }):
    Promise<{ [address in keyof typeof contracts]: InstanceType<typeof contracts[address]> }>

  queryContract <T> (contract: ContractAddress, message: ContractMessage):
    Promise<T>
  queryContract <T> (contract: { address: ContractAddress }, message: ContractMessage):
    Promise<T>
}

export interface CosmWasmAgentApi extends AgentApi {
  /** Chain-specific implementation of code upload. */
  uploadImpl (parameters: {
    binary:       Uint8Array,
    reupload?:    boolean,
    uploadStore?: UploadStore,
    uploadFee?:   Token.Fee
    uploadMemo?:  string
  }): Promise<Partial<UploadedCode & {
    chainId: ChainId,
    codeId:  CodeId
  }>>
  /** Chain-specific implementation of contract instantiation. */
  instantiateImpl (parameters: Partial<Contract> & {
    initMsg:   Into<Message>
    initFee?:  Token.Fee
    initSend?: Token.Coin[]
    initMemo?: string
  }):
    Promise<Contract & { address: Address }>
  /** Chain-specific implementation of contract transaction. */
  executeImpl <T> (parameters: {
    address:   Address
    codeHash?: string
    message:   Message
    execFee?:  Token.Fee
    execSend?: Token.Coin[]
    execMemo?: string
  }): Promise<T>
}
