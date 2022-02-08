import { Console, bold, colors } from '@hackbg/tools'

const console = Console('@fadroma/ops/Agent')

import type { Contract } from './Contract'
import type { Gas } from './Core'
import { resolve, readFileSync, JSONDirectory } from '@hackbg/tools'
import { toBase64 } from '@iov/encoding'

export type AgentConstructor = (new (Identity) => Agent) & { create: (any) => Agent }

import type { Identity, Message, Template } from './Core'
import type { Chain } from './Chain'
import type { Bundle } from './Bundle'
export interface Agent extends Identity {
  readonly chain:   Chain
  readonly address: string
  readonly name:    string
  fees: Record<string, any>

  readonly nextBlock: Promise<void>
  readonly block:     Promise<any>
  readonly account:   Promise<any>
  readonly balance:   Promise<any>

  getBalance  (denomination: string): Promise<any>
  send        (to: any, amount: string|number, denom?: any, memo?: any, fee?: any): Promise<any>
  sendMany    (txs: Array<any>, memo?: string, denom?: string, fee?: any): Promise<any>

  upload      (path: string): Promise<any>
  instantiate (template: Template, label: string, initMsg: Message, funds?: any[]): Promise<any>
  query       (contract: { address: string, codeHash: string }, message: Message): Promise<any>
  execute     (contract: { address: string, codeHash: string }, message: Message, funds?: any[], memo?: any, fee?: any): Promise<any>
  bundle      (): Bundle<this>

  getCodeHash (idOrAddr: number|string): Promise<string>
  getCodeId   (address: string): Promise<number>
  getLabel    (address: string): Promise<string>

  buildAndUpload (contracts: Contract<any>[]): Promise<Template[]>

  traceCall     (callType: string, info?: any): number
  traceResponse (N: number, info?: any)
}

export abstract class BaseAgent implements Agent {
  readonly chain:   Chain
  readonly address: string
  readonly name:    string
  fees: Record<string, any>

  type?:     string
  pubkey?:   string
  mnemonic?: string
  keyPair?:  any
  pen?:      any

  abstract get nextBlock (): Promise<void>
  abstract get block     (): Promise<any>
  abstract get account   (): Promise<any>
  abstract get balance   (): Promise<any>

  abstract getBalance (denomination: string): Promise<any>
  abstract send       (to: any, amount: string|number, denom?: any, memo?: any, fee?: any): Promise<any>
  abstract sendMany   (txs: any[], memo?: string, denom?: string, fee?: any): Promise<any>

  abstract upload      (path: string): Promise<any>
  abstract instantiate (template: Template, label: string, msg: any, funds: any[]): Promise<any>
  abstract query       (contract: { address: string, codeHash: string }, msg: any): Promise<any>
  abstract execute     (contract: { address: string, codeHash: string }, msg: any, funds: any[], memo?: any, fee?: any): Promise<any>
  abstract bundle      (): Bundle<this>

  abstract getCodeHash (idOrAddr: number|string): Promise<string>
  abstract getCodeId   (address: string): Promise<number>
  abstract getLabel    (address: string): Promise<string>

  constructor (_options?: Identity) {}

  buildAndUpload (contracts: Contract<any>[]) {
    return this.chain.buildAndUpload(this, contracts)
  }

  // TODO combine with backoff
  private callCounter = 0
  traceCall (callType = '???', info?) {
    const N = ++this.callCounter
    if (process.env.FADROMA_PRINT_TXS) {
      //console.info()
      const header = `${bold(`${this.name}: call #${String(N).padEnd(4)}`)} (${callType})`
      if (process.env.FADROMA_PRINT_TXS==='trace') {
        console.trace(header)
      } else {
        console.info(header)
      }
      if (info) console.info(JSON.stringify(info))
    }
    return N
  }
  traceSubCall (N: number, callType = '???', info?) {
    if (process.env.FADROMA_PRINT_TXS) {

      const header = `${bold(
        `${this.name}: `+
        `call #${String(N).padEnd(4)}`
      )} (${callType}) `+ `${String(info).slice(0,20)}`

      if (process.env.FADROMA_PRINT_TXS==='trace') {
        console.trace(header)
      } else {
        console.info(header)
      }
      if (info) console.info(JSON.stringify(info))
    }
    return N
  }
  traceResponse (N, txHash?) {
    if (process.env.FADROMA_PRINT_TXS) {
      //console.info()
      console.info(`${bold(`${this.name}: result of call #${N}`)}:`, txHash)
    }
  }
}

export async function waitUntilNextBlock (
  agent:    Agent,
  interval: number = 1000
) {
  console.info(
    bold('Waiting until next block with'), agent.address
  )
  // starting height
  const {header:{height}} = await agent.block
  //console.info(bold('Block'), height)
  // every `interval` msec check if the height has increased
  return new Promise<void>(async resolve=>{
    while (true) {
      // wait for `interval` msec
      await new Promise(ok=>setTimeout(ok, interval))
      // get the current height
      const now = await agent.block
      //console.info(bold('Block'), now.header.height)
      // check if it went up
      if (now.header.height > height) {
        resolve()
        break
      }
    }
  })
}

/** Check if the passed instance has required methods to behave like an Agent */
export const isAgent = (maybeAgent: any): boolean => (
  maybeAgent
  && typeof maybeAgent         === "object"
  && typeof maybeAgent.query   === "function"
  && typeof maybeAgent.execute === "function")

export abstract class BaseGas implements Gas {
  //readonly abstract denom: string
  amount: Array<{amount: string, denom: string}> = []
  gas:    string
  constructor (x: number) {
    const amount = String(x)
    this.gas = amount
  }
}
