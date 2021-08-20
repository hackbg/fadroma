/** I am starting to think that the builder and uploader phases should be accessed
 *  primarily via the Contract object and not as currently; and be separate features
 *  (dynamically loaded unless using fadroma.js in a browser) */

import { Console, bold }
  from '@fadroma/cli'
import { existsSync, readFile, relative, resolve, basename, mkdir, writeFile }
  from '@fadroma/sys'
import { Network, Agent }
  from '@fadroma/agent'
import { Builder }
  from './builder'

const {info} = Console(import.meta.url)

export class BuildUploader extends Builder {

  network: Network
  agent:   Agent

  constructor (options={}) {
    super(options)
    // some puny dependency auto negotiation so you can pass partial objects
    let { network, agent } = options as any
    if (!network && agent) {
      network = agent.network }
    else if (!agent && network) {
      agent = network.defaultAgent }
    this.network = network
    this.agent   = agent }

  /* Contracts will be deployed from this address. */
  get address () {
    return this.agent ? this.agent.address : undefined }

  /** Try to upload a binary to the network but return a pre-existing receipt if one exists.
   *  TODO also code checksums should be validated */
  async uploadCached (artifact: any) {
    const receiptPath = this.getReceiptPath(artifact)
    if (existsSync(receiptPath)) {
      const receiptData = await readFile(receiptPath, 'utf8')
      info(`${bold(relative(process.cwd(), receiptPath))} exists, delete to reupload`)
      return JSON.parse(receiptData) }
    else {
      return this.upload(artifact) } }

  getReceiptPath = (path: string) =>
    resolve(this.network.receipts, `${basename(path)}.upload.json`)

  /** Upload a binary to the network. */
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

