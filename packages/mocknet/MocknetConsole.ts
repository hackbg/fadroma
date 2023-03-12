import { ClientConsole } from '@fadroma/core'

export default class MocknetConsole extends ClientConsole {

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
