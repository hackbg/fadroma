import type {
  IChain, IAgent, IContract,
  ContractUploadOptions,
  ContractInitOptions,
} from './Model'
import { BaseAgent, isAgent } from './Agent'
import { BaseChain, DeploymentsDir } from './Chain'
import { loadSchemas, getAjv, SchemaFactory } from './Schema'

import { existsSync, Console, readFile, bold, relative, basename, mkdir, writeFile } from '@hackbg/tools'

import { backOff } from 'exponential-backoff'

import { ContractCode } from './ContractBuild'

export type ContractConstructorArguments = {
  address?:  string
  codeHash?: string
  codeId?:   number
  admin?:    IAgent,
  prefix?:   string
}

export type ContractConstructor = new (args: ContractConstructorArguments) => IContract

const console = Console(import.meta.url)

type UploadReceipt = {
  codeId:             number
  compressedChecksum: string
  compressedSize:     string
  logs:               unknown[]
  originalChecksum:   string
  originalSize:       number
  transactionHash:    string
}

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

export abstract class ContractInit extends ContractUpload {

  static loadSchemas = loadSchemas

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

  async instantiate (agent?: IAgent): Promise<InitTX> {

    if (this.address) {

      throw new Error(`This contract has already been instantiated at ${this.address}`)

    } else {

      if (agent) this.init.agent = agent

      if (!this.codeId) throw new Error('Contract must be uploaded before instantiating')

      this.init.tx = await backOff(()=>{
        return this.instantiator.instantiate(this.codeId, this.label, this.initMsg)
      }, {
        retry (error: Error, attempt: number) {
          if (error.message.includes('500')) {
            console.warn(`Error 500, retry #${attempt}...`)
            console.error(error)
            return true
          } else {
            return false
          }
        }
      })

      this.init.address = this.initTx?.contractAddress

      this.save()

    }

    return this.initTx

  }

  async instantiateOrExisting (receipt?: InitReceipt, agent?: IAgent): Promise<InitReceipt> {
    if (!receipt) {
      return await this.instantiate(agent)
    } else {
      this.blob.codeHash = receipt.codeHash
      this.init.address  = receipt.initTx.contractAddress
      this.init.label    = receipt.label.split('/')[1]
      if (agent) this.init.agent = agent
      console.info(`${this.label}: already exists at ${this.address}`)
      return receipt
    }
  }

  /** Save the contract's instantiation receipt in the instances directory for this chain.
    * If prefix is set, creates subdir grouping contracts with the same prefix. */
  save () {
    let dir = this.init.agent.chain.deployments
    if (this.init.prefix) dir = dir.subdir(this.init.prefix, DeploymentsDir).make()
    dir.save(this.init.label, this.initReceipt)
    return this
  }

}

export type ContractMessage = string|Record<string, any>

export abstract class ContractCaller extends ContractInit {

  /** Query the contract. */
  query (msg: ContractMessage = "", args = null, agent = this.instantiator) {
    return backoff(() => agent.query(this, msg))
  }

  /** Execute a contract transaction. */
  execute (
    msg: ContractMessage = "",
    memo   = '',
    amount: unknown[] = [],
    fee:    unknown   = undefined,
    agent:  IAgent    = this.instantiator
  ) {
    return backoff(() => agent.execute(this, msg, memo, amount, fee))
  }

}

export function backoff <T> (fn: ()=>Promise<T>) {
  return backOff(fn, {
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
  })
}
