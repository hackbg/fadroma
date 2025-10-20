import type { BaseApi, Fee, Coin, Uint128, Into, ChainId, ChainRef,
  Address, Hash } from './deps.ts';

/** A code ID, identifying uploaded code on a chain. */
export type CodeId       = string|number;

/** The hash of a contract's code. */
export type CodeHash     = string;

/** A contract's full unique on-chain label. */
export type Label        = string;

/** A transaction message that can be sent to a contract. */
export type Message      = string|number|boolean|Record<string, unknown>;

/** The source code of a contract. */
export type SourceCode   = { /** URL pointing to Git upstream containing the canonical source code. */
                             upstream?:  string|URL
                           , /** Pointer to the source commit. */
                             reference?: string
                           , /** Path to local checkout of the source code (with .git directory if sourceRef is set). */
                             checkout?:  string
                           , /** Whether the code contains uncommitted changes. */
                             modified?:  boolean };

/** A binary file somewhere. */
export type CompiledCode = { /** Location of the compiled code. */
                             codePath?: string|URL
                           , /** The compiled code. */
                             codeData?: Uint8Array
                           , /** Checksum uniquely identifying the compiled code. */
                             codeHash?: CodeHash } & Partial<SourceCode>;

/** A code upload to a given chain, represented by a code ID. */
export type UploadedCode = { chain:      ChainRef
                           , /** Code ID representing the identity of the contract's code on a specific chain. */
                             codeId:     CodeId
                           , /** Signer of the upload transaction. */
                             uploadBy?:  Address
                           , /** Hash to the upload transaction. */
                             uploadTx?:  Hash
                           , /** Gas used during the upload. */
                             uploadGas?: Uint128 } & Partial<CompiledCode>;

/** A Map that caches contract uploads, so that the same contract isn't uploaded multiple times. */
export type UploadStore  = Map<CodeHash, UploadedCode>;

/** A contract instance on a given chain. */
export type Contract     = { initBy?: Address
                           , address: Address
                           , label:   string } & Partial<UploadedCode>;

/** Available CosmWasm API methods. */
export type Api          = { log:                Console
                           , fetchSource?:       FetchSource
                           , compile?:           Compile
                           , upload:             Upload
                           , fetchCodeInfo:      FetchCodeInfo
                           , fetchCodeInstances: FetchCodeInstances
                           , instantiate:        Instantiate
                           , fetchContractInfo:  FetchContractInfo
                           , query:              Query
                           , execute:            Execute } & BaseApi;

/** Query a contract. */
export type Query        = <T>(_: { address:   Address
                                  , codeHash?: string
                                  , message:   Message }) => Promise<T>;
/** Execute a contract transaction. */
export type Execute      = <T>(_: { address:   Address
                                  , codeHash?: string
                                  , message:   Message
                                  , execFee?:  Fee
                                  , execSend?: Coin[]
                                  , execMemo?: string }) => Promise<T>;

export type ClientApi    = { /** The selected contract's address. */
                             address:   Address
                           , /** The selected contract's code hash. */
                             codeHash?: CodeHash
                           , /** Query the selected contract. */
                             querySelf <T> (message: Message): Promise<T>
                           , /** Execute a contract transaction on the selected contract. */
                             execSelf  <T> (message: Message, options?: {
                               fee?: Fee, send?: Coin[], memo?: string
                             }): Promise<T> } & Api;

/** Something that can fetch SourceCode from e.g. the filesystem, or a URL. */
export type FetchSource =
  &((source: URL)                 => Promise<SourceCode>)
  &((source: string)              => Promise<SourceCode>)
  &((source: Partial<SourceCode>) => Promise<SourceCode>);

/** Compile method signatures. */
export type Compile =
  & ((source: URL)                   => Promise<CompiledCode>)
  & ((source: string)                => Promise<CompiledCode>)
  & ((source: Partial<CompiledCode>) => Promise<CompiledCode>);

/** Upload method signatures. */
export type Upload =
  & ((source: URL)                   => Promise<UploadedCode>)
  & ((source: string)                => Promise<UploadedCode>)
  & ((source: Uint8Array)            => Promise<UploadedCode>)
  & ((source: Partial<UploadedCode>) => Promise<UploadedCode>)
  & (((parameters: UploadParameters) => Promise<Partial<UploadedCode & { chainId: ChainId, codeId:  CodeId }>>));

export type UploadParameters = { binary:       Uint8Array
                               , reupload?:    boolean
                               , uploadStore?: UploadStore
                               , uploadFee?:   Fee
                               , uploadMemo?:  string };

/** Something that can instantiate UploadedCode to get a Contract instance,
  * e.g. that Chain's respective Agent. */
export type FetchCodeInfo =
  & ((codeId:   CodeId,  options?: { parallel?: boolean }) => Promise<UploadedCode>)
  & (()                                                    => Promise<Record<CodeId, UploadedCode>>)
  & ((codeIds: [CodeId], options?: { parallel?: boolean }) => Promise<Record<CodeId, UploadedCode>>)

export type FetchCodeInfoImpl =
  (args?: {codeIds?: CodeId[], parallel?: boolean}) => Promise<Record<CodeId, UploadedCode>>

export type Instantiate =
  & ((codeId: CodeId, label: Label, init: Message, send?: Coin[], fee?: Fee)           => Promise<Contract>)
  & ((args: { codeId: CodeId, label: Label, init: Message, send?: Coin[], fee?: Fee }) => Promise<Contract>)
  & ((parameters: Partial<Contract> & InstantiateOptions)                              => Promise<Contract & { address: Address }>)

export type InstantiateOptions = { initMsg:   Into<Message>
                                 , initFee?:  Fee
                                 , initSend?: Coin[]
                                 , initMemo?: string };

export type FetchCodeInstances =
  & (()                                                            => Promise<Record<Address, Contract>>)
  & ((codeId:  CodeId)                                             => Promise<Record<Address, Contract>>)
  & ((codeIds: Iterable<CodeId>, options?: { parallel?: boolean }) => Promise<Record<CodeId, Record<Address, Contract>>>);

export type FetchCodeInstancesImpl =
  (args?: {codeIds?: CodeId[], parallel?: boolean}) => Promise<Record<CodeId, Record<Address, Contract>>>;

export type FetchContractInfo =
  & ((address:   Address)                                     => Promise<Contract>)
  & ((addresses: Address[], options?: { parallel?: boolean }) => Promise<Record<Address, Contract>>);

export type * from './deps.ts';
