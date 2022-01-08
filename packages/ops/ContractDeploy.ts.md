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

export type UploadState = {
  chain?:    IChain
  agent?:    IAgent
  codeId?:   number
  codeHash?: string
  receipt?:  UploadReceipt
}

export type UploadOptions = BuildOptions & {
  agent?:  IAgent
  chain?:  IChain
  codeId?: number
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

  blob: UploadState = {}

  constructor (options?: UploadOptions) {
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

export type InitOptions = UploadOptions & {
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

  constructor (options: InitOptions = {}) {
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
