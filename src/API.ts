/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program. If not, see <http://www.gnu.org/licenses/>. **/

import type { Logged, Into } from './Util'

/** An address on a chain. */
export type Address = string
/** A chain's unique ID. */
export type ChainId = string
/** A 128-bit integer. */
export type Uint128 = string
/** A 256-bit integer. */
export type Uint256 = string
/** A 128-bit decimal fraction. */
export type Decimal128 = string
/** A 256-bit decimal fraction. */
export type Decimal256 = string
/** A transaction message that can be sent to a contract. */
export type Message = string|Record<string, unknown>
/** A transaction hash, uniquely identifying an executed transaction on a chain. */
export type TxHash = string
/** A code ID, identifying uploaded code on a chain. */
export type CodeId = string
/** The hash of a contract's code. */
export type CodeHash = string
/** The name of a deployment unit. Used to generate contract label. */
export type Name = string
/** A contract's full unique on-chain label. */
export type Label = string

/** Represents an instance of a blockchain. */
export interface Chain extends Logged {
  /** Unique identifier of chain. */
  readonly id: ChainId
  /** Get a read-only connection to the API endpoint. */
  getConnection ():
    Connection
  /** Authenticate to the chain, obtaining an Agent instance that can send transactions. */
  authenticate (identity?: { mnemonic: string }|Identity):
    Promise<Agent>
  /** Get the current block height. */
  fetchHeight ():
    Promise<bigint>
  /** Wait until the block height increments, or until `this.alive` is set to false. */
  fetchNextBlock ():
    Promise<bigint>
  /** Get info about the latest block. */
  fetchBlock ():
    Promise<Block>
  /** Get info about the block with a specific height. */
  fetchBlock ({ height }: { height: number|bigint, raw?: boolean }):
    Promise<Block>
  /** Get info about the block with a specific hash. */
  fetchBlock ({ hash }: { hash: string, raw?: boolean }):
    Promise<Block>
  /** Fetch balance of 1 address in 1 token. */
  fetchBalance (address: Address, token: string):
    Promise<Uint128>
  /** Fetch balance of 1 address in multiple (or all) tokens. */
  fetchBalance (address: Address, tokens?: string[]):
    Promise<Record<string, Uint128>>
  /** Fetch balance of multiple addresses in 1 token. */
  fetchBalance (addresses: Address[], token: string):
    Promise<Record<Address, Uint128>>
  /** Fetch balance of multiple addresses in multiple (or all) tokens. */
  fetchBalance (addresses: Address[], tokens?: string):
    Promise<Record<Address, Record<string, Uint128>>>
  /** Fetch info about all code IDs uploaded to the chain. */
  fetchCodeInfo ():
    Promise<Record<CodeId, UploadedCode>>
  /** Fetch info about a single code ID. */
  fetchCodeInfo (codeId: CodeId, options?: { parallel?: boolean }):
    Promise<UploadedCode>
  /** Fetch info about multiple code IDs. */
  fetchCodeInfo (codeIds: Iterable<CodeId>, options?: { parallel?: boolean }):
    Promise<Record<CodeId, UploadedCode>>
  /** Fetch all instances of a code ID. */
  fetchCodeInstances (codeId: CodeId):
    Promise<Record<Address, Contract>>
  /** Fetch all instances of a code ID, with custom client class. */
  fetchCodeInstances <C extends typeof Contract> (Contract: C, codeId: CodeId):
    Promise<Record<Address, InstanceType<C>>>
  /** Fetch all instances of multple code IDs. */
  fetchCodeInstances (codeIds: Iterable<CodeId>, options?: { parallel?: boolean }):
    Promise<Record<CodeId, Record<Address, Contract>>>
  /** Fetch all instances of multple code IDs, with custom client class. */
  fetchCodeInstances <C extends typeof Contract> (
    Contract: C, codeIds:  Iterable<CodeId>, options?: { parallel?: boolean }
  ): Promise<Record<CodeId, Record<Address, InstanceType<C>>>>
  /** Fetch all instances of multple code IDs, with multiple custom client classes. */
  fetchCodeInstances (codeIds: { [id: CodeId]: typeof Contract }, options?: { parallel?: boolean }):
    Promise<{[x in keyof typeof codeIds]: Record<Address, InstanceType<typeof codeIds[x]>>}>
  /** Fetch a contract's details wrapped in a `Contract` instance. */
  fetchContractInfo (address: Address): Promise<Contract>
  /** Fetch a contract's details wrapped in a custom class instance. */
  fetchContractInfo <T extends typeof Contract> (Contract: T, address: Address): 
    Promise<InstanceType<T>>
  /** Fetch multiple contracts' details wrapped in `Contract` instance. */
  fetchContractInfo (addresses: Address[], options?: { parallel?: boolean }):
    Promise<Record<Address, Contract>>
  /** Fetch multiple contracts' details wrapped in instances of a custom class. */
  fetchContractInfo <T extends typeof Contract> (
    Contract: T, addresses: Address[], options?: { parallel?: boolean }
  ): Promise<Record<Address, InstanceType<T>>>
  /** Fetch multiple contracts' details, specifying a custom class for each. */
  fetchContractInfo (
    contracts: { [address: Address]: typeof Contract }, options?: { parallel?: boolean }
  ): Promise<{[x in keyof typeof contracts]: InstanceType<typeof contracts[x]>}>
  /** Query a contract by address. */
  query <T> (contract: Address, message: Message):
    Promise<T>
  /** Query a contract object. */
  query <T> (contract: { address: Address }, message: Message):
    Promise<T>
}

/** Represents a remote API endpoint. */
export interface Connection extends Logged {
  /** Chain to which this Connection belongs. */
  readonly chain: Chain
  /** RPC URL to which this connection sends requests. */
  readonly url: string
  /** Whether the connection is alive or we should stop retrying. */
  readonly alive: boolean
  /** Chain-specific implementation of fetchBlock. */
  fetchBlockImpl (parameters?: { raw?: boolean } & ({ height: number|bigint }|{ hash: string })):
    Promise<Block>
  /** Chain-specific implementation of fetchHeight. */
  fetchHeightImpl ():
    Promise<bigint>
  /** Chain-specific implementation of fetchBalance. */
  fetchBalanceImpl (parameters: { addresses: Record<Address, string[]>, parallel?: boolean }):
    Promise<Record<Address, Record<string, Uint128>>>
  /** Chain-specific implementation of fetchCodeInfo. */
  fetchCodeInfoImpl (parameters?: { codeIds?: CodeId[], parallel?: boolean }):
    Promise<Record<CodeId, UploadedCode>>
  /** Chain-specific implementation of fetchCodeInstances. */
  fetchCodeInstancesImpl (parameters: {
    codeIds: { [id: CodeId]: typeof Contract }, parallel?: boolean
  }): Promise<{[x in keyof typeof parameters["codeIds"]]: Record<
    Address, InstanceType<typeof parameters["codeIds"][x]
  >>}>
  /** Chain-specific implementation of fetchContractInfo. */
  fetchContractInfoImpl (parameters: {
    contracts: { [address: Address]: typeof Contract }, parallel?: boolean
  }): Promise<Record<Address, Contract>>
  /** Chain-specific implementation of query. */
  queryImpl <T> (parameters: { address: Address, codeHash?: string, message: Message }):
    Promise<T>
}

export interface Identity extends Logged {
  /** Display name. */
  readonly name?: Address
  /** Address of account. */
  readonly address?: Address
  /** Sign some data with the identity's private key. */
  sign (doc: any): unknown
}

export interface Agent extends Logged {
  /** The chain on which this agent operates. */
  readonly chain: Chain
  /** The identity that will sign the transactions. */
  readonly identity: Identity
  /** Return the address of this agent. */
  readonly address?: Address
  /** Default transaction fees. */
  readonly fees?: FeeMap<'send'|'upload'|'init'|'exec'>
  /** Get a signing connection to the RPC endpoint. */
  getConnection (): SigningConnection
  /** Construct a transaction batch that will be broadcast by this agent. */
  batch (): Batch
  /** Fetch balance of this agent in many (or all) tokens. */
  fetchBalance (tokens?: string[]|string): Promise<Record<string, Uint128>>
  /** Send one or more kinds of native tokens to one or more recipients. */
  send (
    outputs: Record<Address, Record<string, Uint128>>,
    options?: Omit<Parameters<SigningConnection["sendImpl"]>[0], 'outputs'>
  ): Promise<unknown>
  /** Upload a contract's code, generating a new code id/hash pair. */
  upload (
    code: string|URL|Uint8Array|Partial<CompiledCode>,
    options?: Omit<Parameters<SigningConnection["uploadImpl"]>[0], 'binary'>,
  ): Promise<UploadedCode & { chainId: ChainId, codeId:  CodeId }>
  /** Instantiate a new program from a code id, label and init message. */
  instantiate (
    contract: CodeId|Partial<UploadedCode>,
    options: Partial<Contract> & { initMsg: Into<Message>, initSend?: Coin[] }
  ): Promise<Contract & { address: Address, }>
  /** Call a given program's transaction method. */
  execute <T> (
    contract: Address|Partial<Contract>,
    message: Message,
    options?: Omit<Parameters<SigningConnection["executeImpl"]>[0], 'address'|'codeHash'|'message'>
  ): Promise<T>
}

export interface SigningConnection extends Logged {
  readonly chain: Chain
  readonly chainId: ChainId
  readonly identity: Identity
  readonly address: Address
  /** Chain-specific implementation of native token transfer. */
  sendImpl (parameters: SendOptions):
    Promise<unknown>
  /** Chain-specific implementation of code upload. */
  uploadImpl (parameters: UploadOptions):
    Promise<Partial<UploadedCode & { chainId: ChainId, codeId: CodeId }>>
  /** Chain-specific implementation of contract instantiation. */
  instantiateImpl (parameters: InstantiateOptions):
    Promise<Contract & { address: Address }>
  /** Chain-specific implementation of contract transaction. */
  executeImpl <T> (parameters: ExecuteOptions):
    Promise<T>
}

export interface Batch extends Logged {
  /** The chain targeted by the batch. */
  readonly chain: Chain
  /** The agent that will broadcast the batch. */
  readonly agent: Agent
  /** Add an upload message to the batch. */
  upload (...args: Parameters<Agent["upload"]>): this
  /** Add an instantiate message to the batch. */
  instantiate (...args: Parameters<Agent["instantiate"]>): this
  /** Add an execute message to the batch. */
  execute (...args: Parameters<Agent["execute"]>): this
  /** Submit the batch. */
  submit (...args: unknown[]): Promise<unknown> 
}

interface SendOptions {
  outputs: Record<Address, Record<string, Uint128>>,
  sendFee?: Fee,
  sendMemo?: string,
  parallel?: boolean
}

interface UploadOptions {
  binary: Uint8Array,
  reupload?: boolean,
  uploadStore?: UploadStore,
  uploadFee?: Fee
  uploadMemo?: string
}

interface InstantiateOptions extends Partial<Contract> {
  initMsg: Into<Message>
  initFee?: Fee
  initSend?: Coin[]
  initMemo?: string
}

interface ExecuteOptions {
  address: Address
  codeHash?: string
  message: Message
  execFee?: Fee
  execSend?: Coin[]
  execMemo?: string
}

export interface Block {
  /** Chain to which this block belongs. */
  readonly chain: Chain
  /** ID of chain to which this block belongs. */
  readonly chainId: ChainId
  /** Unique ID of block. */
  readonly hash?: string
  /** Unique ID of block. */
  readonly id?: string
  /** Unique identifying hash of block. */
  readonly height?: bigint
  /** Contents of block header. */
  readonly header?: { height?: string|number|bigint }
  /** Transactions in block */
  readonly transactions?: Transaction[]
}

/** A transaction in a block on a chain. */
export interface Transaction {
  /** Block to which this transaction belongs. */
  readonly block: Block
  /** Hash of block to which this transaction belongs. */
  readonly blockHash: string
  /** Height of block to which this transaction belongs. */
  readonly blockHeight: string
  /** Chain to which this transaction belongs. */
  readonly chain: Chain
  /** ID of chain to which this transaction belongs. */
  readonly chainId: string
  /** Unique identifying hash of transaction. */
  readonly hash: string
  /** Unique ID of block. */
  readonly id: string
  /** Any custom data attached to the transaction. */
  readonly data?: unknown
}

export interface Backend extends Logged {
  readonly chainId?: string
  readonly gasToken?: NativeFungibleToken
}

export interface UploadStore extends Map<CodeHash, UploadedCode> {}

export interface SourceCode {
  /** URL pointing to Git upstream containing the canonical source code. */
  readonly sourceOrigin?: string|URL
  /** Pointer to the source commit. */
  readonly sourceRef?: string
  /** Path to local checkout of the source code (with .git directory if sourceRef is set). */
  readonly sourcePath?: string
  /** Whether the code contains uncommitted changes. */
  readonly sourceDirty?: boolean
}

export interface RustSourceCode extends SourceCode {
  /** Path to the crate's Cargo.toml under sourcePath */
  readonly cargoToml?: string
  /** Path to the workspace's Cargo.toml in the source tree. */
  readonly cargoWorkspace?: string
  /** Name of crate. */
  readonly cargoCrate?: string
  /** List of crate features to enable during build. */
  readonly cargoFeatures?: string[]|Set<string>
}

export interface Compiler extends Logged {
  /** Unique identifier of this compiler implementation. */
  id: string
  /** Whether to enable build caching.
    * When set to false, this compiler will rebuild even when
    * binary and checksum are both present in wasm/ directory */
  caching: boolean
  /** Compile a source.
    * `@hackbg/fadroma` implements dockerized and non-dockerized
    * variants using its `build.impl.mjs` script. */
  build (source: string|Partial<SourceCode>, ...args: unknown[]): Promise<CompiledCode>
  /** Build multiple sources.
    * Default implementation of buildMany is sequential.
    * Compiler classes may override this to optimize. */
  buildMany (inputs: Partial<SourceCode>[]): Promise<CompiledCode[]>
}

export interface CompiledCode {
  /** Code hash uniquely identifying the compiled code. */
  readonly codeHash?: CodeHash
  /** Location of the compiled code. */
  readonly codePath?: string|URL
  /** The compiled code. */
  readonly codeData?: Uint8Array
}

export interface UploadedCode {
  /** Code hash uniquely identifying the compiled code. */
  readonly codeHash?: CodeHash
  /** ID of chain on which this contract is uploaded. */
  readonly chainId?: ChainId
  /** Code ID representing the identity of the contract's code on a specific chain. */
  readonly codeId?: CodeId
  /** TXID of transaction that performed the upload. */
  readonly uploadTx?: TxHash
  /** address of agent that performed the upload. */
  readonly uploadBy?: Address
  /** address of agent that performed the upload. */
  readonly uploadGas?: string|number
}

export interface Contract {
  /** Connection to the chain on which this contract is deployed. */
  readonly chain?: Chain
  /** Connection to the chain on which this contract is deployed. */
  readonly agent?: Agent
  /** Code upload from which this contract is created. */
  readonly codeId?: CodeId
  /** The code hash uniquely identifies the contents of the contract code. */
  readonly codeHash?: CodeHash
  /** The address uniquely identifies the contract instance. */
  readonly address?: Address
  /** The label is a human-friendly identifier of the contract. */
  readonly label?: Label
  /** The address of the account which instantiated the contract. */
  readonly initBy?: Address
}

export type ProposalResult = 'Pass'|'Fail'

export interface Proposal {
  readonly id: bigint
  readonly votes: Vote[]
  readonly result: 'Pass'|'Fail'
}

export type VoteValue = 'Yay'|'Nay'|'Abstain'

export interface Vote {
  readonly proposal: Proposal
  readonly voter: Address
  readonly power: bigint
  readonly value: VoteValue
}

export interface Coin {
  readonly amount: Uint128
  readonly denom: string
}

export interface Fee {
  readonly amount: readonly Coin[]
  readonly gas: Uint128
}

export type FeeMap<T extends string> = {
  readonly [key in T]: Fee
}

/** An token on a network. */
export interface Token {
  readonly id: string
  readonly isFungible: boolean
}

/** An abstract non-fungible token. */
export interface NonFungibleToken extends Token {
  readonly isFungible: false
}

/** An abstract fungible token. */
export interface FungibleToken extends Token {
  readonly isFungible: true
  readonly isNative: boolean
}

/** A token supported natively by the chain. */
export interface NativeFungibleToken extends FungibleToken {
  readonly isNative: true
}

/** A contract-based fungible token. */
export interface CustomFungibleToken extends FungibleToken {
  readonly isNative: false
}

export interface TokenAmount {
  readonly amount: Uint128
  readonly denom: string
}

/** A pair of tokens. */
export interface TokenPair {
  readonly a: Token
  readonly b: Token
}

/** A pair of token amounts. */
export interface TokenSwap {
  readonly a: TokenAmount|NonFungibleToken,
  readonly b: TokenAmount|NonFungibleToken,
}

export interface Validator {
  readonly chain: Chain
  readonly address: Address
}
