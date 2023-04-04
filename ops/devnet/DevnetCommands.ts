import Console from './DevnetConsole'

import type { Chain } from '@fadroma/agent'
import { CommandContext } from '@hackbg/cmds'

const log = new Console('@fadroma/devnet')

export default class DevnetCommands extends CommandContext {

  constructor (public chain?: Chain) {
    super('Fadroma Devnet')
  }

  status = this.command('status', 'print the status of the current devnet', () => {
    log.chainStatus(this)
    return this
  })

  reset = this.command('reset', 'erase the current devnet', () => {
    if (this.chain) return resetDevnet({ chain: this.chain })
  })

}

export async function resetDevnet ({ chain }: { chain?: Chain } = {}) {
  if (!chain) {
    log.info('No active chain.')
  } else if (!chain.isDevnet || !chain.node) {
    log.error('This command is only valid for devnets.')
  } else {
    await chain.node.terminate()
  }
}
