import { Console, bold } from '@hackbg/tools'

const { FADROMA_PRINT_TXS = "" } = process.env

export class Trace {

  constructor (
    public name: string,
    private readonly console: Console
  ) {}

  private callCounter = 0

  call (callType = '???', info?): number {
    const N = ++this.callCounter
    if (FADROMA_PRINT_TXS) {
      //this.console.info()
      const header = `${bold(`${this.name}: call #${String(N).padEnd(4)}`)} (${callType})`
      if (FADROMA_PRINT_TXS==='trace') {
        this.console.trace(header)
      } else {
        this.console.info(header)
      }
      if (info) this.console.info(JSON.stringify(info))
    }
    return N
  }

  subCall (N: number, callType = '???', info?) {
    if (FADROMA_PRINT_TXS) {
      const header = `${bold(
        `${this.name}: `+
        `call #${String(N).padEnd(4)}`
      )} (${callType}) `+ `${String(info).slice(0,20)}`
      if (FADROMA_PRINT_TXS==='trace') {
        this.console.trace(header)
      } else {
        this.console.info(header)
      }
      if (info) this.console.info(JSON.stringify(info))
    }
    return N
  }

  response (N, txHash?) {
    if (FADROMA_PRINT_TXS) {
      //this.console.info()
      this.console.info(`${bold(`${this.name}: result of call #${N}`)}:`, txHash)
    }
  }

  initCall (codeId, label): number|void {
    if (FADROMA_PRINT_TXS === 'all' || FADROMA_PRINT_TXS.includes('init')) {
      return this.call(`${bold('INIT')}  ${codeId} ${label}`)
    }
  }

  initResponse (traceId: number|void, result): void {
    if (FADROMA_PRINT_TXS === 'all' || FADROMA_PRINT_TXS.includes('init+result')) {
      this.response(traceId)
    }
  }

  queryCall (contract, msg): number|void {
    if (FADROMA_PRINT_TXS === 'all' || FADROMA_PRINT_TXS.includes('query')) {
      return this.call(
        `${bold(colors.blue('QUERY'.padStart(5)))} `+
        `${bold(getMethod(msg).padEnd(20))} `+
        `on ${contract.address} ${bold(contract.label||'???')}`,
        //{ msg }
      )
    }
  }

  queryResponse (traceId: number|void, response): void {
    if (FADROMA_PRINT_TXS === 'all' || FADROMA_PRINT_TXS.includes('query+result')) {
      this.response(traceId)
    }
  }

  executeCall (contract, msg, funds, memo, fee): number|void {
    if (FADROMA_PRINT_TXS === 'all' || FADROMA_PRINT_TXS.includes('exec')) {
      return this.call(
        `${bold(colors.yellow('TX'.padStart(5)))} `+
        `${bold(getMethod(msg).padEnd(20))} ` +
        `on ${contract.address} ${bold(contract.label||'???')}`,
      )
    }
  }

  executeResponse (traceId: number|void, response): void {
    if (FADROMA_PRINT_TXS === 'all' || FADROMA_PRINT_TXS.includes('init+result')) {
      this.response(traceId, response.transactionHash)
    }
  }

}
