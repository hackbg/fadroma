import { Console, bold, backOff } from '@hackbg/tools'
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
  creator?:     Agent
  initMsg?:     any
  initTx?:      InitTX
  initReceipt?: InitReceipt
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

export type InitTX = {
  txhash:          string
  contractAddress: string
  data:            string
  logs:            Array<any>
  transactionHash: string,
  gas_used:        string
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
  contract: Contract,
  initMsg:  any = contract.initMsg
): Promise<InitTX> {
  console.log()
  console.info(bold('Init:'), contract.codeId, contract.label)
  initMsg = { ...contract.initMsg || {}, ...initMsg }
  printAligned(initMsg)
  if (contract.address) {
    const msg =
      `[@fadroma/ops] This contract has already `+
     `been instantiated at ${contract.address}`
    console.error(msg)
    throw new Error(msg)
  }
  const {
    label,
    codeId,
    creator = contract.creator || contract.admin || contract.agent,
  } = contract
  if (!codeId) {
    throw new Error('[@fadroma/ops] Contract must be uploaded before instantiating (missing `codeId` property)')
  }
  return await backOff(function tryInstantiate () {
    return creator.instantiate(contract, initMsg)
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
