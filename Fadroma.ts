import Config from './FadromaConfig'
import { Deployment } from '@fadroma/core'
import { Deployer, FSUploader } from '@fadroma/deploy'
import { TokenManager } from '@fadroma/tokens'

/** Context for Fadroma commands. */
export default class Fadroma extends Deployment {

  constructor (options: { config?: Partial<Config> } = {}) {
    super(options as any /* FIXME */)
    //this.log.label = this.projectName
    this.config = (options.config instanceof Config) ? options.config : new Config(options.config)
    // Configure build context
    this.workspace = this.config.project
    this.builder ??= this.config?.build?.getBuilder()
    // Create token manager
    this.tokens = new TokenManager(this as Deployment)
    // Define commands
    //this.addCommands('tokens', 'manage token contracts', this.tokens as any)
  }

  /** The current configuration. */
  config: Config

  /** The token manager, containing all tokens known to the project */
  tokens: TokenManager

  get ready () {
    const self = this
    const ready: Promise<typeof this> = (async function getReady (): Promise<typeof self> {
      self.agent    ??= await self.config.getAgent()
      self.chain    ??= await self.agent.chain
      self.uploader ??= await self.agent.getUploader(FSUploader)
      self.builder  ??= await self.config.build.getBuilder()
      return self
    })()
    Object.defineProperty(this, 'ready', { get () { return ready } })
    return ready
  }

}
