import { Console } from '@fadroma/agent'

export default class MocknetConsole extends Console {

  log (...args: any[]) {
    if (process.env.FADROMA_MOCKNET_DEBUG) {
      super.log(...args)
    }
  }

  trace (...args: any[]) {
    // TODO move this env var to a MocknetConfig class like the rest of the modules
    if (process.env.FADROMA_MOCKNET_DEBUG) {
      super.log(...args)
    }
  }

  debug (...args: any[]) {
    if (process.env.FADROMA_MOCKNET_DEBUG) {
      this.log(...args)
    }
  }

}
