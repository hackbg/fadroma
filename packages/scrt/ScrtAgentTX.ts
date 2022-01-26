import { toBase64 } from '@iov/encoding'
import { EnigmaUtils } from 'secretjs'
import { Identity, BaseAgent, Contract, ContractMessage } from '@fadroma/ops'
import type { MsgInstantiateContract, MsgExecuteContract } from 'secretjs/src/types'

export enum TxType {
  Spend        = "spend",
  ContractInit = "contractInit",
  ContractCall = "contractCall",
}

export type UnsignedTX = {
  chain_id:       string
  account_number: string
  sequence:       string
  fee:            string
  msgs:           string
  memo:           string
}

export abstract class ScrtAgentTX extends BaseAgent {

  account_number: number = 0

  sequence: number = 0

  transactions: UnsignedTX[] = []

  private pushTX (...msgs: (MsgInstantiateContract|MsgExecuteContract)[]) {
    const tx = {
      chain_id:       this.chain.chainId,
      account_number: String(this.account_number),
      sequence:       String(this.sequence),
      fee:            "1000000uscrt",
      memo:           "",
      msgs:           JSON.stringify(msgs)
    }
    this.transactions.push(tx)
    return tx
  }

  async instantiate (
    { codeId, codeHash, label }: Contract,
    message,
    init_funds = []
  ): Promise<UnsignedTX> {
    const init_msg = toBase64(await EnigmaUtils.encrypt(codeHash, message))
    return this.pushTX({
      type: "wasm/MsgInstantiateContract",
      value: {
        sender:     this.address,
        code_id:    String(codeId),
        label,
        init_msg,
        init_funds,
      },
    })
  }

  query (contract: Contract, message: ContractMessage) {
    throw new Error('ScrtAgentTX.query: not implemented')
  }

  async execute (
    { address, codeHash }: Contract,
    message: ContractMessage,
    sent_funds = []
  ): Promise<UnsignedTX> {
    const msg = toBase64(await EnigmaUtils.encrypt(codeHash, message))
    return this.pushTX({
      type: "wasm/MsgExecuteContract",
      value: {
        sender:   this.address,
        contract: address,
        msg,
        sent_funds,
      },
    })
  }

}
