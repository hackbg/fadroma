# Fadroma Ops: the `IContract` family of interfaces,
# or, the many aspects of a smart contract's lifecycle

Since this module only contains type definitions, it is light on the imports.
`URL` from Node.js core is used to parse URLs; `Directory` and `JSONFile`
come from [`@fadroma/tools`](../tools) and provide a clean API for accessing
the filesystem (which is used as Fadroma's main datastore).

```typescript
import type { URL } from 'url'
import type { Directory, JSONFile } from '@fadroma/tools'
```

## Contract API

```typescript
export type Savable = {
  save (): this
}
```

### Compiling a smart contract from source into a WASM artifact

This part can be done offline, but cannot be performed from a browser.

* A contract's source code is a Rust `crate` within a Cargo `workspace`.
* The code is compiled in a build container (TODO specify here?),
  which results in an `artifact` (WASM blob) with a particular `codeHash`.

```typescript
export type Buildable = Savable & {

  code:                ContractCodeOptions
  readonly workspace?: string
  readonly crate?:     string

  build (workspace?: string, crate?: string): Promise<any>
  readonly artifact?:                         string
  readonly codeHash?:                         string

}

export type ContractCodeOptions = {
  workspace?: string
  crate?:     string
  artifact?:  string
  codeHash?:  string
}
```

### Uploading a WASM artifact to a blockchain

This is the point where the contract is bound to a particular chain.
This requires a connection via `IChain` and cannot be performed from a browser.

* You need to specify the `chain` and `uploader`.
* Uploading the artifact to a chain results in an `uploadReceipt`
  that contains a `codeId` corresponding to that artifact.

```typescript
import type { IChain } from './Chain.ts.md'
import type { IAgent } from './Chain.ts.md'

export type Uploadable = Buildable & {
  blob:              UploadState
  readonly chain:    IChain
  readonly uploader: IAgent

  upload (chainOrAgent?: IChain|IAgent): Promise<any>
  readonly uploadReceipt: any
  readonly codeId:        number
}

export type ContractUploadOptions = ContractCodeOptions & {
  agent?:  IAgent
  chain?:  IChain
  codeId?: number
}

export type UploadState = {
  chain?:    IChain
  agent?:    IAgent
  codeId?:   number
  codeHash?: string
  receipt?:  UploadReceipt
}

export type UploadReceipt = {
  codeId:             number
  compressedChecksum: string
  compressedSize:     string
  logs:               Array<any>
  originalChecksum:   string
  originalSize:       number
  transactionHash:    string
}

import { BaseAgent } from './Agent.ts.md'
import { BaseChain } from './Chain.ts.md'
import { basename } from '@fadroma/tools'
export abstract class ContractUpload extends ContractCode {

  blob: {
    agent?:    IAgent
    chain?:    IChain
    codeId?:   number
    codeHash?: string
    receipt?:  UploadReceipt
  } = {}

  constructor (options?: ContractUploadOptions) {
    super(options)
    this.blob.agent    = options?.agent
    this.blob.chain    = options?.chain || options?.agent?.chain
    this.blob.codeId   = options?.codeId
    this.blob.codeHash = options?.codeHash
  }

  /** The chain where the contract is deployed. */
  get chain () { return this.blob.chain }
  /** The agent that deployed the contract. */
  get uploader () { return this.blob.agent }
  /** The result of the upload transaction. */
  get uploadReceipt () { return this.blob.receipt }
  /** Path to where the result of the upload transaction is stored */
  get uploadReceiptPath () { return this.chain.uploads.resolve(`${basename(this.artifact)}.json`) }
  /** The auto-incrementing id of the uploaded code */
  get codeId () { return this.blob.codeId }
  /** The auto-incrementing id of the uploaded code */
  get codeHash () { return this.blob.codeHash||this.code.codeHash }
  /** Code ID + code hash pair in Sienna Swap Factory format */
  get template () { return { id: this.codeId, code_hash: this.codeHash } }

  /** Upload the contract to a specified chain as a specified agent. */
  async upload (chainOrAgent?: IAgent|IChain) {

    // resolve chain/agent references
    if (chainOrAgent instanceof BaseChain) {
      this.blob.chain = chainOrAgent as IChain
      this.blob.agent = await this.blob.chain.getAgent()
    } else if (chainOrAgent instanceof BaseAgent) {
      this.blob.agent = chainOrAgent as IAgent
      this.blob.chain = this.blob.agent.chain
    } else if (!this.blob.agent) {
      throw new Error('You must provide a Chain or Agent to use for deployment')
    }

    // build if not already built
    if (!this.artifact) await this.build()

    // upload if not already uploaded
    this.blob.receipt = await upload(this.uploader, this.artifact, this.uploadReceiptPath)

    // set code it and code hash to allow instantiation of uploaded code
    this.blob.codeId   = this.uploadReceipt?.codeId
    this.blob.codeHash = this.uploadReceipt?.originalChecksum
    return this.blob.receipt

  }
}
```

#### The upload procedure itself

```typescript
import { existsSync, readFile, bold, relative, mkdir, writeFile } from '@fadroma/tools'
async function upload (
  uploader:          IAgent,
  artifact:          string,
  uploadReceiptPath: string,
  forceReupload = false
  // TODO: flag to force reupload
) {

  if (existsSync(uploadReceiptPath) && !forceReupload) {

    const receiptData = await readFile(uploadReceiptPath, 'utf8')
    console.info(`${bold(relative(process.cwd(), uploadReceiptPath))} exists, delete to reupload`)
    return JSON.parse(receiptData)

  } else {

    console.info(`Uploading ${bold(artifact)}`)
    const uploadResult = await uploader.upload(artifact)
    const receiptData  = JSON.stringify(uploadResult, null, 2)
    const elements     = uploadReceiptPath.slice(1, uploadReceiptPath.length).split('/');

    let path = `/`
    for (const item of elements) {
      if (!existsSync(path)) mkdir(path)
      path += `/${item}`
    }

    await writeFile(uploadReceiptPath, receiptData, 'utf8')

    await uploader.nextBlock
    return uploadResult

  }

}
```

### Instantiating a smart contract from an uploaded WASM artifact

* Given a `codeId` and an `deployer`, an instance of the contract
  can be created on the chain where this contract was uploaded.
* A `label` needs to be specified for each instance.
  That label needs to be unique for that chain,
  otherwise the instantiation fill fail.
  (TODO: document `prefix`.)
* The contract's `initMsg` contains the
  constructor arguments for that instance.
* Once a contract is instantiated, it gets an `address`.
  The address and code hash constitute a `link` to the contract.
  The contract link is expressed in a bunch of different formats
  across our codebase - here we provide two of them.
* The result of the transaction is available at `initTx`,
  and the response from it is in `initReceipt`.
* TODO: document attaching to a smart contract

```typescript
export type Addressable = {
  readonly address:     string
  readonly link:        { address: string, code_hash: string }
  readonly linkPair:    [ string, string ]
}

export type Instantiable = Uploadable & Addressable & {
  init:                 InitState
  readonly deployer:    IAgent
  readonly label:       string
  readonly initMsg:     any
  instantiate (agent?: IAgent): Promise<any>
  readonly initTx:      any
  readonly initReceipt: any
}

export type ContractInitOptions = ContractUploadOptions & {
  agent?:   IAgent
  address?: string
  prefix?:  string
  label?:   string
  initMsg?: Record<any, any>
}

export type InitState = {
  prefix?:  string
  agent?:   IAgent
  address?: string
  label?:   string
  msg?:     any
  tx?:      InitReceipt
}

export type InitReceipt = {
  label:    string,
  codeId:   number,
  codeHash: string,
  initTx:   InitTX
}

export type InitTX = {
  contractAddress: string
  data:            string
  logs:            unknown[]
  transactionHash: string
}

import { ChainInstancesDir } from './Chain'
import { backOff } from 'exponential-backoff'
export abstract class ContractInit extends ContractUpload {

  init: {
    prefix?:  string
    agent?:   IAgent
    address?: string
    label?:   string
    msg?:     unknown
    tx?:      InitTX
  } = {}

  constructor (options: ContractInitOptions = {}) {
    super(options)
    if (options.prefix)  this.init.prefix  = options.prefix
    if (options.label)   this.init.label   = options.label
    if (options.agent)   this.init.agent   = options.agent
    if (options.address) this.init.address = options.address
    if (options.initMsg) this.init.msg     = options.initMsg
  }

  /** The agent that initialized this instance of the contract. */
  get instantiator () { return this.init.agent }

  /** The on-chain address of this contract instance */
  get address () { return this.init.address }

  /** A reference to the contract in the format that ICC callbacks expect. */
  get link () { return { address: this.address, code_hash: this.codeHash } }

  /** A reference to the contract as an array */
  get linkPair () { return [ this.address, this.codeHash ] as [string, string] }

  /** The on-chain label of this contract instance.
    * The chain requires these to be unique.
    * If a prefix is set, it is prepended to the label. */
  get label () {
    return this.init.prefix
      ? `${this.init.prefix}/${this.init.label}`
      : this.init.label
  }

  /** The message that was used to initialize this instance. */
  get initMsg () { return this.init.msg }

  /** The response from the init transaction. */
  get initTx () { return this.init.tx }

  /** The full result of the init transaction. */
  get initReceipt () {
    return {
      label:    this.label,
      codeId:   this.codeId,
      codeHash: this.codeHash,
      initTx:   this.initTx
    }
  }

  private initBackoffOptions = {
    retry (error: Error, attempt: number) {
      if (error.message.includes('500')) {
        console.warn(`Error 500, retry #${attempt}...`)
        console.error(error)
        return true
      } else {
        return false
      }
    }
  }

  private initBackoff (fn: ()=>Promise<InitTX>) {
    return backOff(fn, this.initBackoffOptions)
  }

  async instantiate (agent?: IAgent) {
    if (!this.address) {
      if (agent) this.init.agent = agent
      if (!this.codeId) throw new Error('Contract must be uploaded before instantiating')
      this.init.tx = await this.initBackoff(()=>{
        return this.instantiator.instantiate(this.codeId, this.label, this.initMsg)
      })
      this.init.address = this.initTx?.contractAddress
      this.save()
    } else if (this.address) {
      throw new Error(`This contract has already been instantiated at ${this.address}`)
    }
    return this.initTx
  }

  async instantiateOrExisting (receipt: InitReceipt, agent?: IAgent) {
    if (receipt) {
      this.blob.codeHash = receipt.codeHash
      this.init.address  = receipt.initTx.contractAddress
      this.init.label    = receipt.label.split('/')[1]
      if (agent) this.init.agent = agent
      console.info(`${this.label}: already exists at ${this.address}`)
      return receipt
    } else {
      return await this.instantiate(agent)
    }
  }

  /** Used by Ensemble to save multiple instantiation receipts in a subdir. */
  setPrefix (prefix: string) {
    this.init.prefix = prefix
    return this
  }

  /** Save the contract's instantiation receipt in the instances directory for this chain.
    * If prefix is set, creates subdir grouping contracts with the same prefix. */
  save () {
    let dir = this.init.agent.chain.instances
    if (this.init.prefix) dir = dir.subdir(this.init.prefix, ChainInstancesDir).make()
    dir.save(this.init.label, this.initReceipt)
    return this
  }

}
```

### Interacting with a smart contract

* Finally, a contract instance can be queried with the `query` method,
  and transactions can be executed with `execute`.
* The schema helpers in [Schema.ts](./Schema.ts)
  automatically generate wrapper methods around `query` and `execute`.

```typescript
export type Contract = Instantiable & {
  query   (method: string, args: any, agent?: IAgent): any
  execute (method: string, args: any, memo: string, send: Array<any>, fee: any, agent?: IAgent): any
}

export type ContractAPIOptions = ContractInitOptions & {
  schema?: Record<string, any>,
}

import { isAgent } from './Agent.ts.md'
export abstract class ContractCaller extends ContractInit {

  private backoffOptions = {
    retry (error: Error, attempt: number) {
      if (error.message.includes('500')) {
        console.warn(`Error 500, retry #${attempt}...`)
        console.warn(error)
        return false
      }
      if (error.message.includes('502')) {
        console.warn(`Error 502, retry #${attempt}...`)
        console.warn(error)
        return true
      }
      return false
    }
  }

  private backoff (fn: ()=>Promise<unknown>) {
    return backOff(fn, this.backoffOptions)
  }

  /** Query the contract. */
  query (method = "", args = null, agent = this.instantiator) {
    return this.backoff(() => agent.query(this, method, args))
  }

  /** Execute a contract transaction. */
  execute (
    method = "",
    args   = null,
    memo   = '',
    amount: unknown[] = [],
    fee:    unknown   = undefined,
    agent:  IAgent    = this.instantiator
  ) {
    return this.backoff(() => agent.execute(this, method, args, memo, amount, fee))
  }

  /** Create a temporary copy of a contract with a different agent.
    * FIXME: Broken - see uploader/instantiator/admin */
  copy = (agent: IAgent) => {
    const addon = {};
    if (isAgent(agent)) {
      // @ts-ignore: ???
      addon.init = {...this.init, agent};
    }
    return Object.assign(
      Object.create(Object.getPrototypeOf(this)),
      addon
    );
  };

}

export type Schema   = Record<string, unknown>
export type Validate = (object: unknown) => unknown
export type Method   = (...args: Array<unknown>) => unknown

import { loadSchemas, getAjv, SchemaFactory } from './Schema'
/** A contract with auto-generated methods for invoking
 *  queries and transactions */
export abstract class ContractAPI extends ContractCaller implements IContract {

  static loadSchemas = loadSchemas

  protected schema: {
    initMsg?:        Schema
    queryMsg?:       Schema
    queryResponse?:  Schema
    handleMsg?:      Schema
    handleResponse?: Schema
  } = {}

  #ajv = getAjv()

  private validate: {
    initMsg?:        Validate
    queryMsg?:       Validate
    queryResponse?:  Validate
    handleMsg?:      Validate
    handleResponse?: Validate
  } = {}

  q:  Record<string, Method>
  tx: Record<string, Method>

  constructor (options: ContractAPIOptions = {}) {
    super(options)
    if (options.schema) this.schema = options.schema
    this.q  = new SchemaFactory(this, this.schema?.queryMsg).create()
    this.tx = new SchemaFactory(this, this.schema?.handleMsg).create()
    for (const [msg, schema] of Object.entries(this.schema)) {
      if (schema) {
        this.validate[msg] = this.#ajv.compile(schema)
      }
    }
  }

}
```

### State types

The `IContract` interface requires 3 properties which are kind of magic:
* `code: ContractCodeOptions`
* `blob: UploadState`
* `init: InitState`

These hold the contract state, select fields of which are exposed via
the getters on `IContract` (as implemented by [`BaseContract`](./Contract.ts)).
The intent behind this is threefold:
* To group internal state for each stage of the process
* To provide quick access to commonly needed values
* To discourage mutation of internal state


## Implementation

```typescript


import { ContractCode } from './ContractBuild'

type ContractConstructor = new (options: unknown) => IContract

export const attachable =
  (Constructor: ContractConstructor) =>
    (address: string, codeHash: string, agent: IAgent) => {
      const instance = new Constructor({})
      instance.init.agent = agent
      instance.init.address = address
      instance.blob.codeHash = codeHash
      return instance
    }

import { Console } from '@fadroma/tools'
const console = Console(import.meta.url)
```
