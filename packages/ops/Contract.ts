import type { Message } from './Core'
import type { BuildInfo, Buildable } from './Build'
import type { UploadInfo, Uploadable, UploadReceipt } from './Upload'
import type { ContractInit, InitTX, InitReceipt } from './Init'

import { Agent, BaseAgent, isAgent } from './Agent'
import { Chain, BaseChain } from './Chain'
import { Deployment, Deployments } from './Deploy'
import { BaseUploader } from './Upload'

import {
  Console, bold,
  resolve, relative, basename,
  existsSync, readFile, writeFile, mkdir,
  homedir, tmp, copy,
  Docker, ensureDockerImage,
  rimraf, spawnSync,
  backOff
} from '@hackbg/tools'

const console = Console('@fadroma/ops/Contract')

import type { Source, Builder, Artifact, Uploader, Template, Instance } from './Core'

import { Init } from './Init'

import { Client, ClientConstructor } from './Client'

export interface ContractInfo {
  source?:   Source
  artifact?: Artifact
  template?: Template
  instance?: Instance
}

export interface Contract<C extends Client> extends ContractInfo {
  readonly name: string

  Builder?: new <B extends Builder> () => Builder
  builder?: Builder
  build? (builder?: Builder): Promise<Artifact>

  Uploader?: new <U extends Uploader> (agent: Agent) => Uploader
  uploader?: Uploader
  upload? (by: Agent|Uploader): Promise<Template>

  initMsg?: any

  Client: ClientConstructor<C>
  client? (agent: Agent): C
}

export abstract class BaseContract<C extends Client> implements Contract<C> {

  constructor (options: any = {}) { Object.assign(this, options) }

  abstract name: string

  source:   Source   | null
  artifact: Artifact | null
  template: Template | null
  instance: Instance | null

  Builder:  new <B extends Builder> () => Builder
  builder:  Builder  | null
  async build (builder: Builder = new this.Builder()) {
    this.builder = builder
    return this.artifact = await this.builder.build(this.source)
  }

  Uploader: new <U extends Uploader> (agent: Agent) => Uploader
  uploader: Uploader | null
  async upload (by: Agent|Uploader) {
    if (by instanceof BaseAgent) by = new this.Uploader(by)
    this.uploader = by as Uploader
    return this.template = await this.uploader.upload(this.artifact)
  }

  Client: ClientConstructor<C>
  client (agent: Agent): C {
    if (!this.instance) {
      throw new Error(
        "@fadroma/ops/Contract: can't get a client to a contract that is not deployed"
      )
    }
    return new this.Client({ ...this.instance, agent })
  }

  prefix?: string
  suffix?: string
  get label (): string {
    if (!this.name) {
      throw new Error(
        '[@fadroma/contract] Tried to get label of contract with missing name.'
      )
    }
    const { prefix, name, suffix } = this
    let label = ''
    if (prefix) { label += `${prefix}/` }
    if (name)   { label += name } else { label += 'UNTITLED' }
    if (suffix) { label += suffix }
    return label
  }

}

/** Extra chunky source of truth about a contract.
  * Way too many parameters.*/
//export class BaseContract implements Contract {\be

  //[>* Allow any property to be overriden at construction. <]
  //constructor (options: any = {}) { Object.assign(this, options) }

  //[>* Allow data to be imported from a Deployment receipt document <]
  //fromReceipt (receipt: InitReceipt) {
    //this.codeId   = receipt.codeId
    //this.codeHash = receipt.codeHash
    //this.address  = receipt.address
    //this.initTx   = receipt.initTx
    //return this
  //}

  //[>* Build environment (Docker only) ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ <]
  //static buildEnv = [ "buildImage", "buildDockerfile", "buildScript" ]
  //[>* Label of local Docker image to use for builds. <]
  //buildImage:      string|null = null
  //[>* Path to Dockerfile for build container if image is not set. <]
  //buildDockerfile: string|null = null
  //[>* Script to be executed in the build container. <]
  //buildScript:     string|null = null
  //[>* Build inputs. ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ <]
  //static buildInputs = [ "repo", "ref", "workspace", "crate", ...this.buildEnv ]
  //[>* Build inputs: TODO allow building contract from external repo. <]
  //repo?:           string // TODO
  //[>* Build inputs: Reference to commit to build. <]
  //ref?:            string = 'HEAD'
  //[>* Build inputs: Root of cargo workspace containing the contract. <]
  //workspace?:      string
  //[>* Build inputs: Name of crate containing the contract. <]
  //crate?:          string
  //[>* Build executor. <]
  //build (...args) { return new Builder(this).build(...args) }
  //[>* Build outputs. ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ <]
  //static buildOutputs = [ "artifact", "codeHash" ]
  //[>* Build outputs: Path to compiled WASM blob. <]
  //artifact?:       string
  //[>* Build outputs: SHA256 checksum of the uncompressed blob. <]
  //codeHash?:       string
  //[>* Upload inputs. ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ <]
  //static uploadInputs = [ "artifact", "codeHash", "chain", "uploader" ]
  //[>* Upload inputs: Target chain. <]
  //chain?:          Chain
  //[>* Upload inputs: Upload agent. <]
  //uploader?:       Agent
  //[>* Upload inputs: Upload executor. <]
  //upload (...args) { return new Uploader(this).upload(...args) }
  //[>* Upload outputs. ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ <]
  //static uploadOutputs = [ "uploadReceipt", "codeId" ]
  //[>* Upload outputs: Result of upload transaction. <]
  //uploadReceipt?:  UploadReceipt
  //[>* Upload outputs: On-chain id of uploaded code. <]
  //codeId?:         number
  //[>* Code ID + code hash pair in Sienna Swap Factory format <]
  //get template () { return { id: this.codeId, code_hash: this.codeHash } }
  //[>* Init inputs. <]
  //static initInputs = [ "codeId", "label", "creator" ]
  //[>* The agent that created the contract. <]
  //creator?:        Agent
  //[>* The label prefix, corresponding to the deployment subdirectory. <]
  //prefix?:         string
  //[>* The contract's given name. <]
  //name?:           string
  //[>* A suffix denoting a given version or iteration. <]
  //suffix?:         string
  /** The on-chain label of this contract instance.
    * The chain requires these to be unique.
    * If a prefix is set, it is prepended to the label. */
  //get label (): string {
    //if (!this.name) {
      //throw new Error(
        //'[@fadroma/contract] Tried to get label of contract with missing name.'
      //)
    //}
    //const { prefix, name, suffix } = this
    //let label = ''
    //if (prefix) { label += `${prefix}/` }
    //if (name)   { label += name } else { label += 'UNTITLED' }
    //if (suffix) { label += suffix }
    //return label
  //}
  /** Manually setting the label is disallowed.
    * Instead, impose prefix-name-suffix scheme. */
  //set label (label: string) {
    //throw new Error(
      //"[@fadroma/contract] Tried to overwrite `contract.label`. "+
      //"Don't - instead, use the `prefix`, `name`, and `suffix` properties"
    //)
  //}
  /** Init procedure is in the Deployment.
    * This is the place to make Contract classes Deployment-aware or standalone. */
  //[>* Init outputs. <]
  //static initOutputs = [ "address", "initTx", "initReceipt" ]
  //[>* Init outputs: Hash of init transaction. <]
  //initTx?:      string
  //[>* Init outputs: Address of contract instance. <]
  //address?:     string
  //[>* A reference to the contract in the format that Fadroma ICC callbacks expect. <]
  //get link () { return { address: this.address, code_hash: this.codeHash } }
  //[>* TX & Query API <]
  //agent?:       Agent
  //[>* Execute a contract transaction. <]
  //execute (
    //msg: Message = "",
    //memo: string = "", amount: unknown[] = [], fee: unknown = undefined,
    //agent: Agent = this.creator || this.agent
  //) {
    //const tryExecute = () => agent.execute(this, msg, amount, memo, fee)
    //return backOff(tryExecute, this.backOffOptions)
  //}
  //[>* Query the contract. <]
  //query (msg: Message = "", agent: Agent = this.creator || this.agent) {
    //const tryQuery = () => agent.query(this, msg)
    //return backOff(tryQuery,  this.backOffOptions)
  //}
  //private backOffOptions = {
    //retry (error: Error, attempt: number) {
      //if (error.message.includes('500')) {
        //console.warn(`Error 500, retry #${attempt}...`)
        //console.warn(error)
        //return false
      //}
      //if (error.message.includes('502')) {
        //console.warn(`Error 502, retry #${attempt}...`)
        //console.warn(error)
        //return true
      //}
      //return false
    //}
  //}

//}
