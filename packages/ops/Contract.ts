import { Agent, BaseAgent, isAgent } from './Agent'
import { Chain, BaseChain } from './Chain'
import { Deployment, DeploymentDir } from './Deployment'
import { loadSchemas } from './Schema'

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

import type { ContractMessage } from './Core'
import type { ContractBuildOptions,  ContractBuild }  from './Build'
import type { ContractUploadOptions, ContractUpload } from './Upload'
export type Contract =
  ContractBuild  &
  ContractUpload &
  ContractInit
export type ContractOptions =
  ContractBuildOptions  &
  ContractUploadOptions &
  ContractInitOptions

export type ContractInitOptions = {
  /** The on-chain address of this contract instance */
  chain?:        Chain
  address?:      string
  codeHash?:     string
  codeId?:       number
  /** The on-chain label of this contract instance.
    * The chain requires these to be unique, so this
    * is meant to be built from the name, prefix and suffix. */
  label?:        string
  name?:         string
  prefix?:       string
  suffix?:       string
  /** The agent that initialized this instance of the contract. */
  instantiator?: Agent
  initMsg?:      any
  initTx?:       InitTX
  initReceipt?:  InitReceipt
}

export interface ContractInit extends ContractInitOptions {
  /** A reference to the contract in the format that ICC callbacks expect. */
  link?:         { address: string, code_hash: string }
  /** A reference to the contract as a tuple */
  linkPair?:     [ string, string ]

  instantiate (message: ContractMessage, agent?: Agent): Promise<any>
  query       (message: ContractMessage, agent?: Agent): any
  execute     (message: ContractMessage, memo: string, send: Array<any>, fee: any, agent?: Agent): any
  save        (): this
}

export type InitTX = {
  contractAddress: string
  data:            string
  logs:            Array<any>
  transactionHash: string
}

export type InitReceipt = {
  label:    string,
  codeId:   number,
  codeHash: string,
  initTx:   InitTX
}

/** Given a Contract instance with the specification of a contract,
  * perform the INIT transaction that creates that contract on the
  * specified blockchain. If the contract already has an address,
  * assume it already exists and bail. */
export async function instantiateContract (
  contract: ContractInit
): Promise<InitTX> {

  if (contract.address) {
    throw new Error(
      `[@fadroma/ops] This contract has already `+
     `been instantiated at ${contract.address}`
    )
  }

  const {
    label,
    codeId,
    instantiator = contract.admin || contract.agent,
    initMsg
  } = contract

  if (!codeId) {
    throw new Error('[@fadroma/ops] Contract must be uploaded before instantiating (missing `codeId` property)')
  }

  console.trace(bold(`Creating from code id ${codeId}:`), label)

  return await backOff(function tryInstantiate () {
    return instantiator.instantiate(contract, initMsg)
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

}

import { FSContractUpload } from './Upload'

export abstract class BaseContract extends FSContractUpload implements ContractInit {

  constructor (
    options: ContractBuildOptions & ContractUploadOptions & ContractInitOptions & {
      admin?: Agent
    } = {}
  ) {
    super(options)
    if (options.admin) {
      this.agent        = options.admin
      this.uploader     = options.admin
      this.instantiator = options.admin
    }
  }

  // init inputs
  chain?:        Chain
  codeId?:       number
  codeHash?:     string
  name?:         string
  prefix?:       string
  suffix?:       string
  instantiator?: Agent

  /** The contents of the init message that creates a contract. */
  initMsg?: Record<string, any> = {}

  /** The default agent for queries/transactions. */
  agent?: Agent

  /** The on-chain label of this contract instance.
    * The chain requires these to be unique.
    * If a prefix is set, it is prepended to the label. */
  get label (): string {
    if (!this.name) {
      throw new Error(
        '[@fadroma/contract] Tried to get label of contract with missing name.'
      )
    }
    let label = this.name
    if (this.prefix) label = `${this.prefix}/${this.name}`
    if (this.suffix) label = `${label}${this.suffix}`
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

  // init outputs
  address?:     string
  initTx?:      InitTX
  initReceipt?: InitReceipt

  /** A reference to the contract in the format that ICC callbacks expect. */
  get link () {
    return {
      address:   this.address,
      code_hash: this.codeHash
    }
  }

  /** A reference to the contract as an array */
  get linkPair () {
    return [ this.address, this.codeHash ] as [string, string] // wat
  }

  /** Save the contract's instantiation receipt in the instances directory for this chain.
    * If prefix is set, creates subdir grouping contracts with the same prefix. */
  save () {

    let dir = this.chain.deployments

    // ugh hahaha so thats where the mkdir was
    if (this.prefix) {
      dir = dir.subdir(this.prefix, DeploymentDir).make() as DeploymentDir
    }

    console.info(
      bold('Saving receipt for contract:'),
      this.name,
      bold('Suffix:'),
      this.suffix
    )

    dir.save(
      `${this.name}${this.suffix||''}`,
      this.initReceipt
    )

    return this

  }

  async instantiateOrExisting (
    receipt?: InitReceipt,
    agent?:   Agent
  ): Promise<InitReceipt> {
    if (!receipt) {
      return await this.instantiate()
    } else {
      if (agent) this.instantiator = agent
      console.info(bold(`Contract already exists:`), this.label)
      console.info(`- On-chain address:`,      bold(receipt.initTx.contractAddress))
      console.info(`- On-chain code hash:`,    bold(receipt.codeHash))
      this.setFromReceipt(receipt)
      return receipt
    }
  }

  async instantiate (): Promise<InitReceipt> {
    this.setFromReceipt(this.initReceipt = {
      label:    this.label,
      codeId:   this.codeId,
      codeHash: this.codeHash,
      initTx:   this.initTx = await instantiateContract(this)
    })
    this.save()
    return this.initReceipt
  }

  private setFromReceipt (receipt: InitReceipt) {
    this.name     = receipt.label.split('/')[1]
    this.codeId   = receipt.codeId
    if (this.codeHash && this.codeHash !== receipt.codeHash) {
      console.warn(
        `Receipt contained code hash: ${bold(receipt.codeHash)}, `+
        `while contract class contained: ${bold(this.codeHash)}. `+
        `Will use the one from the receipt from now on.`
      )
    }
    this.codeHash = receipt.codeHash
    this.initTx   = receipt.initTx
    this.address  = receipt.initTx.contractAddress
    return receipt
  }

  from (deployment: Deployment) {
    const receipt = deployment.contracts[this.name]
    if (!receipt) {
      throw new Error(
        `[@fadroma/ops/Contract] no contract ${this.name} in ${deployment.prefix}`
      )
    }
    this.setFromReceipt(receipt)
    return this
  }

  /** Execute a contract transaction. */
  execute (
    msg:    ContractMessage = "",
    memo:   string          = "",
    amount: unknown[]       = [],
    fee:    unknown         = undefined,
    agent:  Agent          = this.instantiator
  ) {
    return backOff(
      function tryExecute () {
        return agent.execute(this, msg, amount, memo, fee)
      }, {
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
    )
  }

  /** Query the contract. */
  query (
    msg:   ContractMessage = "",
    agent: Agent          = this.instantiator
  ) {
    return backOff(
      function tryQuery () {
        return agent.query(this, msg)
      }, {
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
    )
  }

}
