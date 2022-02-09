import { Console, bold, colors } from '@hackbg/tools'
const console = Console('@fadroma/ops/Agent')

import { resolve, readFileSync, JSONDirectory } from '@hackbg/tools'
import { toBase64 } from '@iov/encoding'

import { Gas, Identity, Message, Template, getMethod } from './Core'
import type { Contract } from './Contract'
import type { Chain } from './Chain'
import type { Bundle } from './Bundle'

export abstract class BaseGas implements Gas {
  //readonly abstract denom: string
  amount: Array<{amount: string, denom: string}> = []
  gas:    string
  constructor (x: number) {
    const amount = String(x)
    this.gas = amount
  }
}

const { FADROMA_PRINT_TXS = "" } = process.env

export type ContractSpec = [Contract<any>, any?, string?, string?]

export abstract class Agent implements Identity {

  trace = new AgentTracer("unnamed")

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

  abstract getBalance  (denomination: string):    Promise<any>
  abstract getCodeHash (idOrAddr: number|string): Promise<string>
  abstract getLabel    (address: string):         Promise<string>
  abstract getCodeId   (address: string):         Promise<number>

  abstract send (to: any, amt: string|number, denom?: any, memo?: any, fee?: any): Promise<any>
  abstract sendMany (txs: any[], memo?: string, denom?: string, fee?: any): Promise<any>

  abstract upload (path: string): Promise<any>

  /** Instantiate a single contract. */
  async instantiate (
    template: Template, label: string, msg: any, funds: any[]
  ): Promise<any> {
    if (!template) {
      throw new Error('@fadroma/ops/Agent: need a Template to instantiate')
    }
    const { chainId, codeId } = template
    if (!template.chainId || !template.codeId) {
      throw new Error('@fadroma/scrt: Template must contain chainId and codeId')
    }
    if (template.chainId !== this.chain.id) {
      throw new Error(`@fadroma/scrt: Template is from chain ${template.chainId}, we're on ${this.chain.id}`)
    }

    let traceId

    if (FADROMA_PRINT_TXS.includes('init')) {
      traceId = this.trace.call(`${bold('INIT')}  ${codeId} ${label}`)
    }

    const result = await this.doInstantiate(template, label, msg, funds)

    if (FADROMA_PRINT_TXS.includes('init-result')) {
      this.trace.response(traceId)
    }

    return result
  }

  abstract instantiateMany (contracts: ContractSpec[], prefix?: string): Promise<any>

  protected abstract doInstantiate (
    template: { chainId: string, codeId: string }, label: string, msg: any, funds: any[]
  ): Promise<any>

  async query (
    contract: { address: string, label: string }, msg: any
  ): Promise<any> {

    let traceId

    if (FADROMA_PRINT_TXS.includes('query')) {
      traceId = this.trace.call(
        `${bold(colors.blue('QUERY'.padStart(5)))} `+
        `${bold(getMethod(msg).padEnd(20))} `+
        `on ${contract.address} ${bold(contract.label||'???')}`,
        //{ msg }
      )
    }

    const response = await this.doQuery(contract, msg)

    if (FADROMA_PRINT_TXS.includes('query-result')) {
      this.trace.response(traceId)
    }

    return response
  }

  protected abstract doQuery (
    contract: { address: string }, msg: any
  ): Promise<any>

  async execute (
    contract: { address: string, label: string }, msg: Message, funds: any[], memo?: any, fee?: any
  ): Promise<any> {

    let traceId

    if (FADROMA_PRINT_TXS.includes('exec')) {
      traceId = this.trace.call(
        `${bold(colors.yellow('TX'.padStart(5)))} `+
        `${bold(getMethod(msg).padEnd(20))} ` +
        `on ${contract.address} ${bold(contract.label||'???')}`,
      )
    }

    const response = await this.doExecute(contract, msg, funds, memo, fee)

    if (FADROMA_PRINT_TXS.includes('init-result')) {
      this.trace.response(traceId, response.transactionHash)
    }

    return response
  }

  protected abstract doExecute (
    contract: { address: string, label: string }, msg: Message, funds: any[], memo?: any, fee?: any
  ): Promise<any>

  abstract bundle (): Bundle

  constructor (_options?: Identity) {}

  buildAndUpload (contracts: Contract<any>[]): Promise<Template[]> {
    return this.chain.buildAndUpload(this, contracts)
  }

  // TODO combine with backoff


}

export class AgentTracer {

  constructor (public name: string) {}

  private callCounter = 0

  call (callType = '???', info?): number {
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

  subCall (N: number, callType = '???', info?) {
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

  response (N, txHash?) {
    if (process.env.FADROMA_PRINT_TXS) {
      //console.info()
      console.info(`${bold(`${this.name}: result of call #${N}`)}:`, txHash)
    }
  }
}

export type AgentConstructor = (new (Identity) => Agent) & { create: (any) => Agent }

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
