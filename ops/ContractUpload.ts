import type { Chain, Agent } from '.'
import { ContractCode } from './ContractBuild'

export class ContractUpload extends ContractCode {
  protected blob: {
    chain?:    Chain
    agent?:    Agent
    codeId?:   number
    codeHash?: string
    receipt?: {
      codeId:             number
      compressedChecksum: string
      compressedSize:     string
      logs:               Array<any>
      originalChecksum:   string
      originalSize:       number
      transactionHash:    string
    }
  } = {}

  constructor (agent?: Agent) {
    super()
    this.blob.agent = agent }

  /** The chain where the contract is deployed. */
  get chain () { return this.blob.chain }
  /** The agent that deployed the contract. */
  get uploader () { return this.blob.agent }
  /** The result of the upload transaction. */
  get uploadReceipt () { return this.blob.receipt }
  /** The auto-incrementing id of the uploaded code */
  get codeId () { return this.blob.codeId }
  /** The auto-incrementing id of the uploaded code */
  get codeHash () { return this.blob.codeHash }

  /** Upload the contract to a specified chain as a specified agent. */
  async upload (chainOrAgent: Agent|Chain) {
    if (chainOrAgent instanceof Chain) {
      this.blob.chain = chainOrAgent
      this.blob.agent = await this.blob.chain.getAgent() }
    else if (chainOrAgent instanceof Agent) {
      this.blob.agent = chainOrAgent
      this.blob.chain = this.blob.agent.chain }
    else {
      throw new Error('You must provide a Chain or Agent to use for deployment') }
    if (!this.artifact) {
      await this.build() }
    const uploader = new ScrtUploader(this.chain, this.uploader)
    this.blob.receipt  = await uploader.uploadOrCached(this.artifact)
    this.blob.codeId   = this.blob.receipt.codeId
    this.blob.codeHash = this.blob.receipt.originalChecksum
    return this.blob.receipt } }

// I'm starting to think that the builder and uploader phases should be accessed
// primarily via the Contract object and not as currently; and be separate features
// (dynamically loaded unless using fadroma.js in a browser) */

const {info} = Console(import.meta.url)

export class ScrtUploader extends ScrtBuilder implements BuildUploader {

  constructor (
    readonly chain: Chain,
    readonly agent: Agent
  ) {
    super()
  }

  /* Contracts will be deployed from this address. */
  get address () {
    return this.agent ? this.agent.address : undefined }

  /** Try to upload a binary to the chain but return a pre-existing receipt if one exists.
   *  TODO also code checksums should be validated */
  async uploadOrCached (artifact: any) {
    const receiptPath = this.getReceiptPath(artifact)
    if (existsSync(receiptPath)) {
      const receiptData = await readFile(receiptPath, 'utf8')
      info(`${bold(relative(process.cwd(), receiptPath))} exists, delete to reupload`)
      return JSON.parse(receiptData) }
    else {
      return this.upload(artifact) } }

  getReceiptPath = (path: string) =>
    this.chain.uploads.resolve(`${basename(path)}.json`)

  /** Upload a binary to the chain. */
  async upload (artifact: any) {
    const uploadResult = await this.agent.upload(artifact)
        , receiptData  = JSON.stringify(uploadResult, null, 2)
        , receiptPath  = this.getReceiptPath(artifact)
        , elements     = receiptPath.slice(1, receiptPath.length).split('/');
    let path = `/`
    for (const item of elements) {
      if (!existsSync(path)) mkdir(path)
      path += `/${item}` }
    await writeFile(receiptPath, receiptData, 'utf8')
    return uploadResult } }
