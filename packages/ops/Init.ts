import { Console, bold, backOff, relative, cwd } from '@hackbg/tools'
import type { Chain } from './Chain'
import type { Agent } from './Agent'
import type { Contract } from './Contract'
import { ContractMessage, InitTX, InitReceipt } from './Core'

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
  /** Message passed on init */
  initMsg?: any
  /** Txhash of init tx */
  initTx?:  string
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
    public readonly prefix?: string,
    public readonly after?: (InitReceipt)=>void
  ) {}

  /** Given a Contract instance with the specification of a contract,
    * perform the INIT transaction that creates that contract on the
    * specified blockchain. If the contract already has an address,
    * assume it already exists and bail. */
  async instantiate (
    { codeId, codeHash }: Template,
    label:    string,
    initMsg:  any = contract.initMsg
  ): Promise<InitReceipt> {
    //this.assertNoAddress(contract)
    //this.assertCodeId(contract)
    contract.creator = this.creator
    if (this.prefix) contract.prefix = this.prefix // changes label
    initMsg = { ...contract.initMsg || {}, ...initMsg }
  console.info('init.instantiate', this.creator.instantiate)
    const initTx = await this.creator.instantiate(contract, initMsg)
    console.log('easefasdf', initTx)
    const receipt = {
      codeId,
      codeHash,
      label,
      address:  initTx.contractAddress,
      initTx:   initTx.transactionHash,
      gasUsed:  initTx.gas_used
    }
    contract.fromReceipt(receipt)
    if (this.after) this.after(receipt)
    return receipt
  }

  //private assertNoAddress (contract: Contract) {
    //if (contract.address) {
      //const msg =
        //`This contract has already been ` +
        //`instantiated at ${contract.address}. ` +
        //`Use a fresh instance of ${contract.constructor.name} ` +
        //`if you want to deploy a new instance of the contract.`
      //console.error(msg)
      //throw new Error(`[@fadroma/ops/Init] `+msg)
    //}
  //}

  //private assertCodeId (contract: Contract) {
    //if (!contract.codeId) {
      //const msg =
        //`This contract must be uploaded `+
        //`before it can be instantiated. `+
        //`I.e., missing 'codeId' property.`
      //console.error(msg)
      //throw new Error('[@fadroma/ops/Init] '+msg)
    //}
  //}

  private shouldRetry
}
