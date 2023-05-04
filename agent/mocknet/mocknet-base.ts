import { Error, Console, bold, colors } from '../agent-base'

class MocknetConsole extends Console {
  label = 'Mocknet'
}

class MocknetError extends Error {
  static ContextNoAddress = this.define('ContextNoAddress',
    () => "MocknetBackend#context: Can't create contract environment without address")
  static NoInstance = this.define('NoInstance',
    () => `MocknetBackend#getInstance: can't get instance without address`)
  static NoInstanceAtAddress = this.define('NoInstanceAtAddress',
    (address: string) => `MocknetBackend#getInstance: no contract at ${address}`)
  static NoChain = this.define('NoInstance',
    () => `MocknetAgent#chain is not set`)
  static NoBackend = this.define('NoInstance',
    () => `Mocknet#backend is not set`)
}

export {
  MocknetConsole as Console,
  MocknetError   as Error,
  bold,
  colors
}
