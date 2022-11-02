import { ClientConsole, ClientError } from '@fadroma/client'

export class MocknetConsole extends ClientConsole {

  trace (...args: any[]) {
    // TODO move this env var to a MocknetConfig class like the rest of the modules
    if (process.env.FADROMA_MOCKNET_DEBUG) {
      this.trace(...args)
    }
  }

  debug (...args: any[]) {
    if (process.env.FADROMA_MOCKNET_DEBUG) {
      this.debug(...args)
    }
  }

}

export class MocknetError extends ClientError {
}
