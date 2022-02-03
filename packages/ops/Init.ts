import { Console, bold, backOff, relative, cwd } from '@hackbg/tools'
import type { Chain } from './Chain'
import type { Agent } from './Agent'
import type { Contract } from './Contract'
import { ContractMessage, printAligned } from './Core'

const console = Console('@fadroma/ops/Init')

export type ContractInitOptions = {
  /** The chain on which this contract exists. */
  chain?:    Chain
  codeId?:   number
  codeHash?: string
  /** The on-chain address of this contract instance */
  address?:  string

  prefix?: string
  name?:   string
  suffix?: string

  /** The agent that initialized this instance of the contract. */
  creator?: Agent
  initMsg?: any
  initTx?:  InitTX
}

export interface ContractInit extends ContractInitOptions {
  /** The final label of the contract (generated from prefix, name, and suffix,
    * because the chain expects these to be globally unique.) */ 
  readonly label: string
  /** A reference to the contract in the format that ICC callbacks expect. */
  link?:  { address: string, code_hash: string }
  query   (message: ContractMessage, agent?: Agent): any
  execute (message: ContractMessage, memo: string, send: Array<any>, fee: any, agent?: Agent): any
}

export class Init {

  constructor (
    public readonly creator: Agent,
    public readonly prefix?: string
  ) {}
  /** Given a Contract instance with the specification of a contract,
    * perform the INIT transaction that creates that contract on the
    * specified blockchain. If the contract already has an address,
    * assume it already exists and bail. */
  async instantiate (
    contract: Contract,
    initMsg:  any = contract.initMsg
  ): Promise<InitReceipt> {
    if (contract.address) {
      const msg =
        `This contract has already been ` +
        `instantiated at ${contract.address}. ` +
        `Use a fresh instance of ${contract.constructor.name} ` +
        `if you want to deploy a new instance of the contract.`
      console.error(msg)
      throw new Error(`[@fadroma/ops/Init] `+msg)
    }
    if (!contract.codeId) {
      const msg =
        `This contract must be uploaded `+
        `before it can be instantiated. `+
        `I.e., missing 'codeId' property.`
      console.error(msg)
      throw new Error('[@fadroma/ops/Init] '+msg)
    }
    contract.creator = this.creator
    contract.prefix  = this.prefix // changes label
    const { codeId, label } = contract
    //console.info(bold('Code:'), codeId)
    //console.info(bold('Init:'), label)
    //console.info(bold('From:'), this.creator.address)
    //if (this.prefix) console.info(bold('Into:'), this.prefix)
    initMsg = { ...contract.initMsg || {}, ...initMsg }
    //printAligned(initMsg)

    //if (String(process.env.FADROMA_PRINT_TXS).includes('init')) {
      //console.debug(
        //`${bold('Init')} ${contract.codeId} ${contract.constructor.name} ${contract.name} "${label}"`, {
          //contract: `${contract.name} (${contract.constructor.name})`,
          //creator: contract.creator.address,
          //codeId, label, initMsg
        //}
      //)
    //}

    const initTx = await backOff(function tryInstantiate () {
      return contract.creator.instantiate(contract, initMsg)
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

    const receipt = {
      name:     contract.name,
      codeId:   contract.codeId,
      codeHash: contract.codeHash,
      address:  initTx.contractAddress,
      label:    contract.label,
      initTx:   initTx.transactionHash,
      gasUsed:  initTx.gas_used
    }

    contract.fromReceipt(receipt)

    //console.info(bold(`${receipt.gasUsed}`), 'uscrt gas used.')

    if (String(process.env.FADROMA_PRINT_TXS).includes('init')) {
      console.debug(
        `${bold('InitResponse')} ${contract.codeId} ${contract.constructor.name} ${contract.name} "${label}"`,
        receipt
      )
    }

    return receipt
  }
}

export type InitTX = {
  txhash:          string
  contractAddress: string
  data:            string
  logs:            Array<any>
  transactionHash: string,
  gas_used:        string
}

export type InitReceipt = {
  label:    string
  codeId:   number
  codeHash: string
  address:  string
  initTx:   string
  gasUsed:  string
}
