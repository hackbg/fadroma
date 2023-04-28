import { Console } from '../util'

export default class MocknetConsole extends Console {
  log (...args: any[]) {
    if (process.env.FADROMA_MOCKNET_DEBUG) {
      super.log(...args)
    }
    return this
  }
  trace (...args: any[]) {
    // TODO move this env var to a MocknetConfig class like the rest of the modules
    if (process.env.FADROMA_MOCKNET_DEBUG) {
      super.log(...args)
    }
    return this
  }
  debug (...args: any[]) {
    if (process.env.FADROMA_MOCKNET_DEBUG) {
      this.log(...args)
    }
    return this
  }
}
