import { Console, bold } from '@hackbg/tools'

const {
  FADROMA_PRINT_TXS
} = process.env

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
}
