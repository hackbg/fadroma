import { Agent } from './Agent'
import { Chain } from './ChainAPI'
import type { ContractUploadOptions } from './Contract'
import { ContractCode } from './ContractBuild'
import { Console, existsSync, readFile, bold, relative, basename, mkdir, writeFile } from '@fadroma/tools'

const {info} = Console(import.meta.url)

export abstract class ContractUpload extends ContractCode {

  blob: {
    agent?:    Agent
    chain?:    Chain
    codeId?:   number
    codeHash?: string
    receipt?: {
      codeId:             number
      compressedChecksum: string
      compressedSize:     string
      logs:               Array<any>
      originalChecksum:   string
      originalSize:       number
      transactionHash:    string } } = {}

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

  /** Upload the contract to a specified chain as a specified agent. */
  async upload (chainOrAgent?: Agent|Chain) {

    // resolve chain/agent references
    if (chainOrAgent instanceof Chain) {
      this.blob.chain = chainOrAgent
      this.blob.agent = await this.blob.chain.getAgent() }
    else if (chainOrAgent instanceof Agent) {
      this.blob.agent = chainOrAgent
      this.blob.chain = this.blob.agent.chain }
    else if (!this.blob.agent) {
      throw new Error('You must provide a Chain or Agent to use for deployment') }

    // build if not already built
    if (!this.artifact) await this.build()

    // upload if not already uploaded
    // TODO: flag to force reupload
    if (existsSync(this.uploadReceiptPath)) {
      const receiptData = await readFile(this.uploadReceiptPath, 'utf8')
      info(`${bold(relative(process.cwd(), this.uploadReceiptPath))} exists, delete to reupload`)
      this.blob.receipt = JSON.parse(receiptData) }
    else {
      const uploadResult = await this.uploader.upload(this.artifact)
          , receiptData  = JSON.stringify(uploadResult, null, 2)
          , elements     = this.uploadReceiptPath.slice(1, this.uploadReceiptPath.length).split('/');
      let path = `/`
      for (const item of elements) {
        if (!existsSync(path)) mkdir(path)
        path += `/${item}` }
      await writeFile(this.uploadReceiptPath, receiptData, 'utf8')
      this.blob.receipt = uploadResult }

    // set code it and code hash to allow instantiation of uploaded code
    this.blob.codeId   = this.uploadReceipt.codeId
    this.blob.codeHash = this.uploadReceipt.originalChecksum
    return this.blob.receipt } }
