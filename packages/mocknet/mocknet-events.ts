import { ClientConsole, ClientError } from '@fadroma/core'

export class MocknetConsole extends ClientConsole {

  log (...args: any[]) {
    console.log(123)
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

export class MocknetError extends ClientError {
  static ContextNoAddress = this.define('ContextNoAddress',
    () => "MocknetBackend#context: Can't create contract environment without address")
  static NoInstance = this.define('NoInstance',
    () => `MocknetBackend#getInstance: can't get instance without address`)
  static NoInstanceAtAddress = this.define('NoInstanceAtAddress',
    (address: string) => `MocknetBackend#getInstance: no contract at ${address}`)
}
