import type { Api as BaseApi, Fee, Coin } from '@fadroma/tm';
import type { Uint128, Into, ChainId, ChainRef, Address, Hash } from './deps.ts'
export type Address = string

/** A code ID, identifying uploaded code on a chain. */
export type CodeId = string|number
/** The hash of a contract's code. */
export type CodeHash = string
/** A contract's full unique on-chain label. */
export type Label = string
/** A transaction message that can be sent to a contract. */
export type Message = string|number|boolean|Record<string, unknown>
/** Available CosmWasm API methods. */
export type Api = BaseApi & {
  log:                Console
  fetchSource?:       FetchSource
  compile?:           Compile,
  upload:             Upload,
  fetchCodeInfo:      FetchCodeInfo,
  fetchCodeInstances: FetchCodeInstances,
  instantiate:        Instantiate,
  fetchContractInfo:  FetchContractInfo
  /** Query a contract. */
  query   <T> (parameters: { address: Address, codeHash?: string, message: Message }): Promise<T>
  /** Execute a contract transaction. */
  execute <T> (parameters: {
    address:   Address
    codeHash?: string
    message:   Message
    execFee?:  Fee
    execSend?: Coin[]
    execMemo?: string
  }): Promise<T>
};

export type ClientApi = Api & {
  /** The selected contract's address. */
  address: Address,
  /** The selected contract's code hash. */
  codeHash?: CodeHash,
  /** Query the selected contract. */
  querySelf <T> (message: Message): Promise<T>
  /** Execute a contract transaction on the selected contract. */
  execSelf <T> (message: Message, options?: {
    fee?:  Fee,
    send?: Coin[], 
    memo?: string
  }): Promise<T>
};

/** Something that can fetch SourceCode from e.g. the filesystem, or a URL. */
export type FetchSource =
  &((source: string)=> Promise<SourceCode>)
  &((source: URL)=> Promise<SourceCode>)
  &((source: Partial<SourceCode>)=> Promise<SourceCode>);

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
};

/** Compile method signatures. */
export type Compile =
  & ((source: string)=> Promise<CompiledCode>)
  & ((source: URL)=> Promise<CompiledCode>)
  & ((source: Partial<CompiledCode>)=> Promise<CompiledCode>);

/** A binary file somewhere. */
export type CompiledCode = Partial<SourceCode> & {
  /** Location of the compiled code. */
  readonly codePath?: string|URL
  /** The compiled code. */
  readonly codeData?: Uint8Array
  /** Checksum uniquely identifying the compiled code. */
  readonly codeHash?: CodeHash
};

/** Upload method signatures. */
export type Upload =
  & ((source: string)=>Promise<UploadedCode>)
  & ((source: URL)=>Promise<UploadedCode>)
  & ((source: Uint8Array)=>Promise<UploadedCode>)
  & ((source: Partial<UploadedCode>)=>Promise<UploadedCode>)
  & (((parameters: {
      binary:       Uint8Array,
      reupload?:    boolean,
      uploadStore?: UploadStore,
      uploadFee?:   Fee
      uploadMemo?:  string
    }) => Promise<Partial<UploadedCode & {
      chainId: ChainId,
      codeId:  CodeId
    }>>))

/** A code upload to a given chain, represented by a code ID. */
export type UploadedCode = Partial<CompiledCode> & {
  readonly chain:      ChainRef
  /** Code ID representing the identity of the contract's code on a specific chain. */
  readonly codeId:     CodeId
  /** Signer of the upload transaction. */
  readonly uploadBy?:  Address
  /** Hash to the upload transaction. */
  readonly uploadTx?:  Hash
  /** Gas used during the upload. */
  readonly uploadGas?: Uint128
}

/** A Map that caches contract uploads, so that the same contract isn't uploaded multiple times. */
export type UploadStore = Map<CodeHash, UploadedCode>

/** Something that can instantiate UploadedCode to get a Contract instance,
  * e.g. that Chain's respective Agent. */
export type FetchCodeInfo =
  & (() => Promise<Record<CodeId, UploadedCode>> )
  & ((codeId: CodeId, options?: { parallel?: boolean }) => Promise<UploadedCode>)
  & ((codeIds: [CodeId], options?: { parallel?: boolean }) => Promise<Record<CodeId, UploadedCode>>)

export type FetchCodeInfoImpl =
  (args?: {codeIds?: CodeId[], parallel?: boolean}) =>
    Promise<Record<CodeId, UploadedCode>>

export type Instantiate =
  & ((codeId: CodeId, label: Label, init: Message, send?: Coin[], fee?: Fee) =>
    Promise<Contract>)
  & ((args: { codeId: CodeId, label: Label, init: Message, send?: Coin[], fee?: Fee }) =>
    Promise<Contract>)
  & ((parameters: Partial<Contract> & {
      initMsg:   Into<Message>
      initFee?:  Fee
      initSend?: Coin[]
      initMemo?: string
    }) => Promise<Contract & { address: Address }>)

export type FetchCodeInstances =
  & (() => Promise<Record<Address, Contract>>)
  & ((codeId: CodeId) => Promise<Record<Address, Contract>>)
  & ((codeIds: Iterable<CodeId>, options?: { parallel?: boolean }) =>
    Promise<Record<CodeId, Record<Address, Contract>>>)

export type FetchCodeInstancesImpl =
  (args?: {codeIds?: CodeId[], parallel?: boolean}) =>
    Promise<Record<CodeId, Record<Address, Contract>>>

export type FetchContractInfo =
  & ((address: Address) => Promise<Contract>)
  & ((addresses: Address[], options?: { parallel?: boolean }) => Promise<Record<Address, Contract>>)

/** A contract instance on a given chain. */
export type Contract = Partial<UploadedCode> & {
  readonly initBy?: Address
  readonly address: Address
  readonly label:   string
}
