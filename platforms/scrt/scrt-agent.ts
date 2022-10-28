import type { AgentClass, AgentOpts, BundleClass, CodeHash, Message } from '@fadroma/client'
import { Agent } from '@fadroma/client'
import { Scrt } from './scrt'
import { ScrtConsole } from './scrt-events'
import type { ScrtBundle } from './scrt-bundle'

/** Agent configuration options that are common betweeen
  * gRPC and Amino implementations of Secret Network. */
export interface ScrtAgentOpts extends AgentOpts {
  keyPair?: unknown
}

/** Base class for both implementations of Secret Network API (gRPC and Amino).
  * Represents a connection to the Secret Network authenticated as a specific address. */
export abstract class ScrtAgent extends Agent {

  static Bundle: BundleClass<ScrtBundle>

  log = new ScrtConsole('ScrtAgent')

  Bundle: BundleClass<ScrtBundle> =
    ((this.constructor as AgentClass<Agent>).Bundle) as BundleClass<ScrtBundle>

  fees = Scrt.defaultFees

  abstract getNonce (): Promise<{ accountNumber: number, sequence: number }>

  abstract encrypt (codeHash: CodeHash, msg: Message): Promise<string>

}
