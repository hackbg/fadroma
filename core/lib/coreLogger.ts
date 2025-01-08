import { Console } from '../deps.ts'
/** A chain's log and error handler. */
export class CoreLogger extends Console {
  static unknownChains = 0
  static unknownChain  = () => `Unknown chain #${++this.unknownChains}`
  static noConnections = () => new Error('no connections')
  fetchingBlockByHeight = (h: unknown, ...args: unknown[]) =>
    this.debug(`fetching block by height ${h}`, ...args)
  fetchingBlockByHash = (h: unknown, ...args: unknown[]) =>
    this.debug(`fetching block by hash ${h}`, ...args)
  waitingForNextBlock = (h: unknown, t: unknown, ...args: unknown[]) =>
    this.debug(`checking for block >${h} every ${t}ms`, ...args)
}
