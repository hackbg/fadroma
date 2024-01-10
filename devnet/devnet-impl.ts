/** Private implementations! These should not be reexported outside the package. */

import deasync from 'deasync'
import { onExit } from 'gracy'
import { bold } from '@fadroma/agent'
import type { Connection, Identity } from '@fadroma/agent'
import type { default as DevnetContainer } from './devnet-base'

export async function connect <C extends Connection, I extends Identity> (
  devnet:      DevnetContainer,
  $Connection: { new (...args: unknown[]): C },
  $Identity:   { new (...args: unknown[]): I },
  parameter:   string|Partial<I & { name?: string, mnemonic?: string }> = {}
): Promise<C> {
  if (typeof parameter === 'string') {
    parameter = { name: parameter } as Partial<I & { name?: string, mnemonic?: string }>
  }
  await devnet.containerStarted
  return new $Connection({
    chainId:  devnet.chainId,
    url:      devnet.url?.toString(),
    alive:    devnet.running,
    identity: new $Identity(parameter.mnemonic
      ? parameter as { mnemonic: string }
      : await devnet.getIdentity(parameter))
  })
}

// Set an exit handler on the process to let the devnet
// stop/remove its container if configured to do so
export function setExitHandler (devnet) {
  if (!this.exitHandler) {
    this.log.debug('Registering exit handler')
    onExit(this.exitHandler = defineExitHandler(this), { logger: false })
  } else {
    this.log.warn('Exit handler already registered')
  }
}

function defineExitHandler (devnet) {
  let called = false
  return function exitHandler (this: DevnetContainer) {
    if (called) {
      this.log.trace('Exit handler called more than once')
      return
    }
    called = true
    this.log.debug('Running exit handler')
    if (this.onExit === 'delete') {
      this.log.log(`Exit handler: stopping and deleting ${this.chainId}`)
      deasync(this.pause.bind(this))()
      this.log.log(`Stopped ${this.chainId}`)
      deasync(this.delete.bind(this))()
      this.log.log(`Deleted ${this.chainId}`)
    } else if (this.onExit === 'pause') {
      this.log.log(`Stopping ${this.chainId}`)
      deasync(this.pause.bind(this))()
      this.log.log(`Stopped ${this.chainId}`)
    } else {
      this.log.log(
        'Devnet is running on port', bold(String(this.nodePort)),
        `from container`, bold(this.containerId?.slice(0,8))
      ).info('To remove the devnet:'
      ).info('  $ npm run devnet reset'
      ).info('Or manually:'
      ).info(`  $ docker kill`, this.containerId?.slice(0,8),
      ).info(`  $ docker rm`, this.containerId?.slice(0,8),
      ).info(`  $ sudo rm -rf state/${this.chainId??'fadroma-devnet'}`)
    }
    this.log.debug('Exit handler complete')
  }.bind(devnet)
}

/** Regexp for filtering out non-printable characters that may be output by the containers. */
export const RE_NON_PRINTABLE = /[\x00-\x1F]/

/** Function that filters out noise from devnet output.
  * FIXME: This should pass through the output verbatim,
  * maybe just replacing non-printables with Braille characters
  * a la brailledump. */
export const FILTER = (data: string) =>
  ((data.length > 0 && data.length <= 1024)
    && !data.startsWith('TRACE ')
    && !data.startsWith('DEBUG ')
    && !data.startsWith('INFO ')
    && !data.startsWith('I[')
    && !data.startsWith('Storing key:')
    && !RE_NON_PRINTABLE.test(data)
    && !data.startsWith('{"app_message":')
    && !data.startsWith('configuration saved to')
  )
