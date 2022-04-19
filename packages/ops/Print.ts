import { Console, bold, colors } from '@hackbg/toolbox'
import { config } from './Config'
import type { Message } from './Core'
import type { Uploads } from './Upload'
import type { Deployments } from './Deploy'
import type { Agent } from './Agent'

const console = Console('@fadroma/ops/Print')

export const print = console => {

  const print = {

    url ({ protocol, hostname, port }: URL) {
      console.info(bold(`Protocol: `), protocol)
      console.info(bold(`Host:     `), `${hostname}:${port}`)
    },

    async agentBalance (agent: Agent) {
      console.info(bold(`Agent:    `), agent.address)
      try {
        const initialBalance = await agent.balance
        console.info(bold(`Balance:  `), initialBalance, `uscrt`)
      } catch (e) {
        console.warn(bold(`Could not fetch balance:`), e.message)
      }
    },

    identities (chain: any) {
      console.log('\nAvailable identities:')
      for (const identity of chain.identities.list()) {
        console.log(`  ${chain.identities.load(identity).address} (${bold(identity)})`)
      }
    },

    aligned (obj: Record<string, any>) {
      const maxKey = Math.max(...Object.keys(obj).map(x=>x.length), 15)
      for (let [key, val] of Object.entries(obj)) {
        if (typeof val === 'object') val = JSON.stringify(val)
        val = String(val)
        if ((val as string).length > 60) val = (val as string).slice(0, 60) + '...'
        console.info(bold(`  ${key}:`.padEnd(maxKey+3)), val)
      }
    },

    contracts (contracts) {
      contracts.forEach(print.contract)
    },

    contract (contract) {
      console.info(
        String(contract.codeId).padStart(12),
        contract.address,
        contract.name
      )
    },

    async token (TOKEN) {
      if (typeof TOKEN === 'string') {
        console.info(
          `   `,
          bold(TOKEN.padEnd(10))
        )
      } else {
        const {name, symbol} = await TOKEN.info
        console.info(
          `   `,
          bold(symbol.padEnd(10)),
          name.padEnd(25).slice(0, 25),
          TOKEN.address
        )
      }
    },

    deployment ({ receipts, prefix }) {
      const count = Object.values(receipts).length
      if (count > 0) {
        for (const name of Object.keys(receipts).sort()) {
          print.receipt(name, receipts[name])
        }
      } else {
        console.info('This deployment is empty.')
      }
    },

    receipt (name, receipt) {
      if (receipt.address) {
        console.info(
          `${receipt.address}`.padStart(45),
          String(receipt.codeId||'n/a').padStart(6),
          bold(name.padEnd(35)),
        )
      } else {
        console.warn(
          '(non-standard receipt)'.padStart(45),
          'n/a'.padEnd(6),
          bold(name.padEnd(35)),
        )
      }
    }

  }

  return print

}

export class Trace {

  constructor (
    public name: string,
    private readonly console: any
  ) {}

  private callCounter = 0

  call (callType = '???', info?): number {
    const N = ++this.callCounter
    if (config.printTXs) {
      //this.console.info()
      const header = `${bold(`${this.name}: call #${String(N).padEnd(4)}`)} (${callType})`
      if (config.printTXs==='trace') {
        this.console.trace(header)
      } else {
        this.console.info(header)
      }
      if (info) this.console.info(JSON.stringify(info))
    }
    return N
  }

  subCall (N: number, callType = '???', info?) {
    if (config.printTXs) {
      const header = `${bold(
        `${this.name}: `+
        `call #${String(N).padEnd(4)}`
      )} (${callType}) `+ `${String(info).slice(0,20)}`
      if (config.printTXs==='trace') {
        this.console.trace(header)
      } else {
        this.console.info(header)
      }
      if (info) this.console.info(JSON.stringify(info))
    }
    return N
  }

  response (N, txHash?) {
    if (config.printTXs) {
      //this.console.info()
      this.console.info(`${bold(`${this.name}: result of call #${N}`)}:`, txHash)
    }
  }

  initCall (codeId, label): number|void {
    if (config.printTXs === 'all' || config.printTXs.includes('init')) {
      return this.call(`${bold('INIT')}  ${codeId} ${label}`)
    }
  }

  initResponse (traceId: number|void, result): void {
    if (config.printTXs === 'all' || config.printTXs.includes('init+result')) {
      this.response(traceId)
    }
  }

  queryCall (contract, msg): number|void {
    if (config.printTXs === 'all' || config.printTXs.includes('query')) {
      return this.call(
        `${bold(colors.blue('QUERY'.padStart(5)))} `+
        `${bold(getMethod(msg).padEnd(20))} `+
        `on ${contract.address} ${bold(contract.label||'???')}`,
        //{ msg }
      )
    }
  }

  queryResponse (traceId: number|void, response): void {
    if (config.printTXs === 'all' || config.printTXs.includes('query+result')) {
      this.response(traceId)
    }
  }

  executeCall (contract, msg, funds, memo, fee): number|void {
    if (config.printTXs === 'all' || config.printTXs.includes('exec')) {
      return this.call(
        `${bold(colors.yellow('TX'.padStart(5)))} `+
        `${bold(getMethod(msg).padEnd(20))} ` +
        `on ${contract.address} ${bold(contract.label||'???')}`,
      )
    }
  }

  executeResponse (traceId: number|void, response): void {
    if (config.printTXs === 'all' || config.printTXs.includes('init+result')) {
      this.response(traceId, response.transactionHash)
    }
  }

}

export function getMethod (msg: Message) {
  if (typeof msg === 'string') {
    return msg
  } else {
    const keys = Object.keys(msg)
    if (keys.length !== 1) {
      throw new Error(
        `@fadroma/scrt: message must be either an object `+
        `with one root key, or a string. Found: ${keys}`
      )
    }
    return Object.keys(msg)[0]
  }
}
