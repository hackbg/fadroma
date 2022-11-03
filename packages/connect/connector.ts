import type { Class } from '@fadroma/client'
import { Deployment } from '@fadroma/client'
import { ConnectConfig } from './connect-config'
import { ConnectConsole as Console } from './connect-events'

/** Constructor for a subclass of Connector that
  * maintains the original constructor signature. */
export interface ConnectorClass<C extends Connector> extends Class<C, [
  Partial<Connector>
]>{}

/** A Deployment with associated Agent and awareness of other chains. */
export class Connector extends Deployment {
  constructor (options: Partial<Connector> = { config: new ConnectConfig() }) {
    super(options)
    this.config = new ConnectConfig(this.env, this.cwd, options?.config)
  }
  /** Logger */
  log = new Console('Fadroma.Connector')
  /** Configuration. */
  config: ConnectConfig
  /** List all known chains. */
  chains = this.command('chains', 'print a list of all known chains', async () => {
    this.log.supportedChains()
    this.log.selectedChain(this.config.chain as string)
  })
}
