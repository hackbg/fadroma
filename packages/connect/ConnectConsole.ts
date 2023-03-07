import { Chain, ClientConsole, bold } from '@fadroma/core'

export default class ConnectConsole extends ClientConsole {

  label = 'Fadroma Connect'

  supportedChains (supportedChains: Record<string, unknown> = Chain.variants) {
    this.br()
    this.info('Known chain names:')
    for (const chain of Object.keys(supportedChains).sort()) {
      this.info(`  ${bold(chain)}`)
    }
  }

  noName (chains: Record<string, unknown>) {
    this.error('Pass a known chain name or set FADROMA_CHAIN env var.')
    this.supportedChains(chains)
    return 1
  }

  selectedChain (chain?: string) {
    this.br()
    if (chain) {
      this.info('Selected chain:')
      this.info(`  ${bold(chain)}`)
    } else {
      this.info('No selected chain. Set FADROMA_CHAIN in .env or shell environment.')
    }
    this.br()
  }

}
