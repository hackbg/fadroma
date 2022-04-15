import { Console, bold, colors } from '@hackbg/toolbox'
import { Message } from './Core'
import { config } from './Config'

export class Trace {

  constructor (
    public name: string,
    private readonly console: Console
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
