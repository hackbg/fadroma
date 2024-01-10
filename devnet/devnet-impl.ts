/** Actually private definitions.
  * Not part of the TS *or* JS public API,
  * i.e. not accessible at all outside the package. */

import deasync from 'deasync'
import { onExit } from 'gracy'
import $ from '@hackbg/file'
import { bold } from '@fadroma/agent'
import type { Connection, Identity } from '@fadroma/agent'
import type { default as DevnetContainer } from './devnet-base'
import type { APIMode } from './devnet'

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

/** Run the cleanup container, deleting devnet state even if emitted as root. */
export async function forceDelete (devnet: DevnetContainer) {
  const path = $(devnet.stateDir).shortPath
  devnet.log('Running cleanup container for', path)
  const cleanupContainer = await devnet.containerImage.run({
    name: `${devnet.chainId}-cleanup`,
    entrypoint: '/bin/rm',
    command: ['-rvf', '/state'],
    options: {
      extra: {
        AutoRemove: true,
        HostConfig: { Binds: [`${$(devnet.stateDir).path}:/state:rw`] }
      }
    },
  })
  await cleanupContainer.start()
  devnet.log('Waiting for cleanup container to finish...')
  await cleanupContainer.wait()
  devnet.log(`Deleted ${path}/* via cleanup container.`)
  $(devnet.stateDir).delete()
}

/** Options for the devnet container. */
export function containerOptions (devnet: DevnetContainer) {
  const Binds: string[] = []
  if (devnet.initScript) {
    Binds.push(`${devnet.initScript.path}:${devnet.initScriptMount}:ro`)
  }
  if (!devnet.dontMountState) {
    Binds.push(`${$(devnet.stateDir).path}:/state/${devnet.chainId}:rw`)
  }
  const NetworkMode  = 'bridge'
  const PortBindings = {[`${devnet.nodePort}/tcp`]: [{HostPort: `${devnet.nodePort}`}]}
  const HostConfig   = {Binds, NetworkMode, PortBindings}
  const Tty          = true
  const AttachStdin  = true
  const AttachStdout = true
  const AttachStderr = true
  const Hostname     = devnet.chainId
  const Domainname   = devnet.chainId
  const extra   = {Tty, AttachStdin, AttachStdout, AttachStderr, Hostname, Domainname, HostConfig}
  const options = {env: devnet.environment, exposed: [`${devnet.nodePort}/tcp`], extra}
  return options
}

/** Environment variables in the devnet container. */
export function containerEnvironment (devnet: DevnetContainer) {
  const env: Record<string, string> = {
    DAEMON:    devnet.nodeBinary||'',
    TOKEN:     devnet.gasToken?.denom,
    CHAIN_ID:  devnet.chainId!,
    ACCOUNTS:  JSON.stringify(devnet.genesisAccounts),
    STATE_UID: String((process.getuid!)()),
    STATE_GID: String((process.getgid!)()),
  }
  if (devnet.verbose) {
    env['VERBOSE'] = 'yes'
  }
  const portVar = portVars[devnet.nodePortMode!]
  if (portVar) {
    env[portVar] = String(devnet.nodePort)
  } else {
    devnet.log.warn(`Unknown port mode ${devnet.nodePortMode}, devnet may not be accessible.`)
  }
  if (devnet.verbose) {
    for (const [key, val] of Object.entries(env)) {
      devnet.log.debug(`  ${key}=${val}`)
    }
  }
  return env
}

/** Mapping of connection type to environment variable
  * used by devnet.init.mjs to set port number. */
const portVars: Record<APIMode, string> = {
  http: 'HTTP_PORT', grpc: 'GRPC_PORT', grpcWeb: 'GRPC_WEB_PORT', rpc: 'RPC_PORT',
}

/** Default port numbers for each kind of port. */
export const defaultPorts: Record<APIMode, number> = {
  http: 1317, grpc: 9090, grpcWeb: 9091, rpc: 26657
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
