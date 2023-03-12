import { ClientConsole, ClientError } from '@fadroma/core'

export default class MocknetError extends ClientError {

  static ContextNoAddress = this.define('ContextNoAddress',
    () => "MocknetBackend#context: Can't create contract environment without address")

  static NoInstance = this.define('NoInstance',
    () => `MocknetBackend#getInstance: can't get instance without address`)

  static NoInstanceAtAddress = this.define('NoInstanceAtAddress',
    (address: string) => `MocknetBackend#getInstance: no contract at ${address}`)

}
