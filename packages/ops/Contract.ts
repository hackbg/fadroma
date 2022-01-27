import type { ContractMessage } from './Core'
import type { BuildInfo, Build, Buildable } from './Build'
import type { UploadInfo, Upload, Uploadable, UploadReceipt } from './Upload'
import type { ContractInitInfo, ContractInit, InitTX, InitReceipt } from './Deployment'

export type Contract     = Buildable & Uploadable & ContractInit
export type ContractInfo = BuildInfo & UploadInfo & InitInfo

import { Agent, BaseAgent, isAgent } from './Agent'
import { Chain, BaseChain } from './Chain'
import { Deployment, DeploymentDir } from './Deployment'
import { Builder  } from './Build'
import { Uploader } from './Upload'

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
/** Extra chunky source of truth about a contract. */
export class BaseContract implements Contract {
  /** Allow any property to be overriden at construction. */
  constructor (options: ContractInfo = {}) { Object.assign(this, options) }
  /** Build environment (Docker only) ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~ */
  static buildEnv = [ "buildImage", "buildDockerfile", "buildScript" ]
  /** Label of local Docker image to use for builds. */
  buildImage:      string|null = null
  /** Path to Dockerfile for build container if image is not set. */
  buildDockerfile: string|null = null
  /** Script to be executed in the build container. */
  buildScript:     string|null = null
  /** Build inputs. */
  static buildInputs = [ "repo", "ref", "workspace", "crate", ...this.buildEnv ]
  /** Build inputs: TODO allow building contract from external repo. */
  repo?:           string // TODO
  /** Build inputs: Reference to commit to build. */
  ref?:            string = 'HEAD'
  /** Build inputs: Root of cargo workspace containing the contract. */
  workspace?:      string
  /** Build inputs: Name of crate containing the contract. */
  crate?:          string
  /** Build executor. */
  build (...args) { return new Builder(this).build(...args) }
  /** Build outputs. */
  static buildOutputs = [ "artifact", "codeHash" ]
  /** Build outputs: Path to compiled WASM blob. */
  artifact?:       string
  /** Build outputs: SHA256 checksum of the uncompressed blob. */
  codeHash?:       string
  /** Upload inputs. */
  static uploadInputs = [ "artifact", "codeHash", "chain", "uploader" ]
  /** Upload inputs: Target chain. */
  chain?:          Chain
  /** Upload inputs: Upload agent. */
  uploader?:       Agent
  /** Upload inputs: Upload executor. */
  upload (...args) { return new Uploader(this).upload(...args) }
  /** Upload outputs. */
  static uploadOutputs = [ "uploadReceipt", "codeId" ]
  /** Result of upload transaction. */
  uploadReceipt?:  UploadReceipt
  /** On-chain id of uploaded code. */
  codeId?:         number
  /** Code ID + code hash pair in Sienna Swap Factory format */
  get template () { return { id: this.codeId, code_hash: this.codeHash } }
  /** Init inputs. */
  static initInputs = [ "codeId", "label", "creator" ]
  /** The agent that created the contract. */
  creator?:        Agent
  /** The label prefix, corresponding to the deployment subdirectory. */
  prefix?:         string
  /** The contract's given name. */
  name?:           string
  /** A suffix denoting a given version or iteration. */
  suffix?:         string
  /** The on-chain label of this contract instance.
    * The chain requires these to be unique.
    * If a prefix is set, it is prepended to the label. */
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
  /** Manually setting the label is disallowed.
    * Instead, impose prefix-name-suffix scheme. */
  set label (label: string) {
    throw new Error(
      "[@fadroma/contract] Tried to overwrite `contract.label`. "+
      "Don't - use the `prefix`, `name`, and `suffix`. properties instead"
    )
  }
  /** Init procedure is in the Deployment.
    * This is the place to make Contract classes Deployment-aware or standalone. */
  /** Init outputs. */
  static initOutputs = [ "address", "initTx", "initReceipt" ]

  initTx?:      InitTX

  initReceipt?: InitReceipt

  address?:     string

  /** A reference to the contract in the format that ICC callbacks expect. */
  get link () {
    return {
      address:   this.address,
      code_hash: this.codeHash
    }
  }
  /** TX & Query API */
  agent?:       Agent
  /** Execute a contract transaction. */
  execute (
    msg:    ContractMessage = "",
    memo:   string          = "",
    amount: unknown[]       = [],
    fee:    unknown         = undefined,
    agent:  Agent           = this.creator || this.agent
  ) {
    return backOff(
      function tryExecute () { return agent.execute(this, msg, amount, memo, fee) },
      this.backOffOptions
    )
  }
  /** Query the contract. */
  query (
    msg:   ContractMessage = "",
    agent: Agent           = this.creator || this.agent
  ) {
    return backOff(
      function tryQuery () { return agent.query(this, msg) },
      this.backOffOptions
    )
  }
  private backOffOptions = {
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
}
