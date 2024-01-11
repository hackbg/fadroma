/** Actually private definitions.
  * Not part of the TS *or* JS public API,
  * i.e. not accessible at all outside the package. */

import deasync from 'deasync'
import { onExit } from 'gracy'
import portManager from '@hackbg/port'
import $, { JSONFile } from '@hackbg/file'
import { bold } from '@fadroma/agent'
import type { Path } from '@hackbg/file'
import { Console, colors, randomBase16, randomColor } from '@fadroma/agent'
import type { Connection, Identity } from '@fadroma/agent'
import type { default as DevnetContainer } from './devnet-base'
import type { APIMode } from './devnet'

type $D<T extends keyof DevnetContainer> = Pick<DevnetContainer, 'log'|T>

export function initPort (
  devnet: $D<'nodePortMode'|'nodePort'>
) {
  if (devnet.nodePortMode) {
    devnet.nodePort ??= defaultPorts[devnet.nodePortMode]
  }
}

export function initImage (
  devnet: $D<
    'containerEngine'|'containerImageTag'|'containerImage'|'containerManifest'|'initScriptMount'
  >
) {
  if (devnet.containerEngine && devnet.containerImageTag) {
    devnet.containerImage = devnet.containerEngine.image(
      devnet.containerImageTag,
      devnet.containerManifest,
      [devnet.initScriptMount]
    )
    devnet.containerImage.log.label = devnet.log.label
  }
}

export function initChainId (
  devnet: $D<'chainId'|'platform'>
) {
  if (!devnet.chainId) {
    if (devnet.platform) {
      devnet.chainId = `local-${devnet.platform}-${randomBase16(4).toLowerCase()}`
    } else {
      throw new Error('no platform or chainId specified')
    }
  }
}

export function initLogger (
  devnet: $D<'chainId'>
) {
  const loggerColor = randomColor({ luminosity: 'dark', seed: devnet.chainId })
  const loggerTag   = colors.whiteBright.bgHex(loggerColor)(devnet.chainId)
  const logger      = new Console(`Devnet ${loggerTag}`)
  Object.defineProperties(devnet, {
    log: {
      enumerable: true, configurable: true, get () {
        return logger
      }, set () {
        throw new Error("can't change devnet logger")
      }
    }
  })
}

export function initState (
  devnet:  $D<'stateDir'|'stateFile'|'chainId'>,
  options: Partial<$D<'stateDir'|'stateFile'>>
) {
  Object.assign(devnet, {
    stateDir:  $(options.stateDir ?? $('state', devnet.chainId).path),
    stateFile: $(options.stateFile ?? $(devnet.stateDir, 'devnet.json')).as(JSONFile)
  })
  if ($(devnet.stateDir).isDirectory() && devnet.stateFile.isFile()) {
    try {
      const state = (devnet.stateFile.as(JSONFile).load() || {}) as Record<any, unknown>
      // Options always override stored state
      options = { ...state, ...options }
    } catch (e) {
      console.error(e)
      throw new Error(
        `failed to load devnet state from ${devnet.stateFile.path}: ${e.message}`
      )
    }
  }
}

export function initDynamicUrl (
  devnet: $D<'nodeProtocol'|'nodeHost'|'nodePort'>
) {
  Object.defineProperties(devnet, {
    url: {
      enumerable: true, configurable: true, get () {
        let url = `${devnet.nodeProtocol}://${devnet.nodeHost}:${devnet.nodePort}`
        try {
          return new URL(url).toString()
        } catch (e) {
          devnet.log.error(`Invalid URL: ${url}`)
          throw e
        }
      }, set () {
        throw new Error("can't change devnet url")
      }
    },
  })
}

export function initCreateDelete (
  devnet: DevnetContainer
) {
  let creating = null
  let deleting = null
  Object.defineProperties(devnet, {
    created: {
      configurable: true,
      get () {
        return creating ||= Promise.resolve(deleting).then(async()=>{
          await createDevnetContainer(devnet)
          await devnet.save()
          deleting = null
        })
      }
    },
    deleted: {
      configurable: true,
      get () {
        return deleting ||= Promise.resolve(creating).then(async()=>{
          await deleteDevnetContainer(devnet)
          creating = null
        })
      }
    }
  })
}

export function initStartPause (
  devnet: DevnetContainer
) {
  let starting = null
  let stopping = null
  Object.defineProperties(devnet, {
    created: {
      configurable: true,
      get () {
        return starting ||= Promise.resolve(stopping).then(async()=>{
          await startDevnetContainer(devnet)
          stopping = null
        })
      }
    },
    deleted: {
      configurable: true,
      get () {
        return stopping ||= Promise.resolve(starting).then(async()=>{
          await pauseDevnetContainer(devnet)
          starting = null
        })
      }
    }
  })
}

export async function connect <C extends Connection, I extends Identity> (
  devnet:      $D<'chainId'|'url'|'running'|'stateDir'|'created'|'started'>,
  $Connection: { new (...args: unknown[]): C },
  $Identity:   { new (...args: unknown[]): I },
  parameter:   string|Partial<I & { name?: string, mnemonic?: string }> = {}
): Promise<C> {
  if (typeof parameter === 'string') {
    parameter = { name: parameter } as Partial<I & { name?: string, mnemonic?: string }>
  }
  await devnet.started
  return new $Connection({
    chainId:  devnet.chainId,
    url:      devnet.url?.toString(),
    alive:    devnet.running,
    identity: new $Identity(parameter.mnemonic
      ? parameter as { mnemonic: string }
      : await getIdentity(devnet, parameter))
  })
}

export async function getIdentity (
  devnet: $D<'stateDir'|'created'|'started'>,
  name:   string|{name?: string}
) {
  if (typeof name === 'object') {
    name = name.name!
  }
  if (!name) {
    throw new Error('no name')
  }
  devnet.log.debug('Authenticating to devnet as genesis account:', bold(name))
  if (!$(devnet.stateDir).exists()) {
    devnet.log.debug('Waking devnet container')
    await devnet.created
    await devnet.started
  }
  return $(devnet.stateDir, 'wallet', `${name}.json`)
    .as(JSONFile<Partial<Identity> & { mnemonic: string }>)
    .load()
}

/** Options for the devnet container. */
export function containerOptions (
  devnet: $D<
    |'chainId'|'gasToken'|'initScript'|'initScriptMount'|'stateDir'
    |'nodePortMode'|'nodePort'|'nodeBinary'|'genesisAccounts'|'verbose'
  >
) {
  const Binds: string[] = []
  if (devnet.initScript) {
    Binds.push(`${devnet.initScript.path}:${devnet.initScriptMount}:ro`)
  }
  Binds.push(`${$(devnet.stateDir).path}:/state/${devnet.chainId}:rw`)
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
  const options = {env: containerEnvironment(devnet), exposed: [`${devnet.nodePort}/tcp`], extra }
  return options
}

/** Environment variables in the devnet container. */
export function containerEnvironment (
  devnet: $D<
    |'chainId'|'gasToken'|'nodeBinary'|'nodePortMode'|'nodePort'|'genesisAccounts'|'verbose'
  >
) {
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
export function setExitHandler (
  devnet: $D<'exitHandler'>
) {
  if (!this.exitHandler) {
    this.log.debug('Registering exit handler')
    onExit(this.exitHandler = defineExitHandler(this), { logger: false })
  } else {
    this.log.warn('Exit handler already registered')
  }
}

function defineExitHandler (
  devnet: $D<'onExit'|'paused'|'deleted'|'chainId'|'nodePort'|'containerId'>
) {
  let called = false
  return function exitHandler (
    this: $D<'onExit'|'paused'|'deleted'|'chainId'|'nodePort'|'containerId'>
  ) {
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

export async function createDevnetContainer (
  devnet: $D<
    |'url'|'container'|'containerId'|'containerImage'|'verbose'
    |'chainId'|'gasToken'|'initScript'|'initScriptMount'|'stateDir'
    |'nodePortMode'|'nodePort'|'nodeBinary'|'genesisAccounts'
  >
): Promise<void> {
  const exists = await devnet.container?.catch(()=>null)
  if (exists) {
    devnet.log(`Found`, bold(devnet.chainId), `in container`, bold(devnet.containerId?.slice(0, 8)))
  } else {
    if (devnet.verbose) {
      devnet.log.debug('Creating container for', bold(devnet.chainId))
    }
    // ensure we have image and chain id
    await devnet.containerImage.ensure()
    if (!devnet.chainId) {
      throw new Error("can't create devnet without chain ID")
    }
    // if port is unspecified or taken, increment
    devnet.nodePort = await portManager.getFreePort(devnet.nodePort)
    // create container
    devnet.log(`Creating devnet`, bold(devnet.chainId), `on`, bold(String(devnet.url)))
    const init = devnet.initScript ? [devnet.initScriptMount] : []
    const container = devnet.containerImage!.container(
      devnet.chainId, containerOptions(devnet), init
    )
    container.log.label = devnet.log.label
    await container.create()
    setExitHandler(devnet)
    // set id and save
    if (devnet.verbose) {
      devnet.log.debug(`Created container:`, bold(devnet.containerId?.slice(0, 8)))
    }
    devnet.containerId = container.id
  }
}

export async function deleteDevnetContainer (
  devnet: $D<'container'|'containerId'|'stateDir'>
): Promise<void> {
  devnet.log('Deleting...')
  let container
  try {
    container = await devnet.container
  } catch (e) {
    if (e.statusCode === 404) {
      devnet.log(`No container found`, bold(devnet.containerId?.slice(0, 8)))
    } else {
      throw e
    }
  }
  if (container && await container?.isRunning) {
    if (await container.isRunning) {
      await devnet.pause()
    }
    await container.remove()
    devnet.containerId = undefined
  }
  const state = $(devnet.stateDir)
  const path = state.shortPath
  try {
    if (state.exists()) {
      devnet.log(`Deleting ${path}...`)
      state.delete()
    }
  } catch (e: any) {
    if (e.code === 'EACCES' || e.code === 'ENOTEMPTY') {
      devnet.log.warn(`unable to delete ${path}: ${e.code}, trying cleanup container`)
      await forceDelete(devnet)
    } else {
      devnet.log.error(`failed to delete ${path}:`, e)
      throw e
    }
  }
}

/** Run the cleanup container, deleting devnet state even if emitted as root. */
export async function forceDelete (
  devnet: $D<'stateDir'|'containerImage'|'chainId'>
) {
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

export async function startDevnetContainer (
  devnet: $D<
    |'running'|'container'|'containerId'|'save'|'readyString'|'postLaunchWait'
    |'nodeHost'|'nodePort'|'chainId'|'waitPort'
  >
) {
  if (!devnet.running) {
    const container = await devnet.container ?? await (await devnet.create()).container!
    devnet.log.debug(`Starting container:`, bold(devnet.containerId?.slice(0, 8)))
    try {
      await container.start()
    } catch (e) {
      devnet.log.warn(e)
      // Don't throw if container already started.
      // TODO: This must be handled in @fadroma/oci
      if (e.code !== 304) throw e
    }
    devnet.running = true
    await devnet.save()
    devnet.log.debug('Waiting for container to say:', bold(devnet.readyString))
    await container.waitLog(devnet.readyString, FILTER, true)
    devnet.log.debug('Waiting for', bold(String(devnet.postLaunchWait)), 'seconds...')
    await new Promise(resolve=>setTimeout(resolve, devnet.postLaunchWait))
    //await Dock.Docker.waitSeconds(devnet.postLaunchWait)
    await devnet.waitPort({ host: devnet.nodeHost, port: Number(devnet.nodePort) })
  } else {
    devnet.log.log('Container already started:', bold(devnet.chainId))
  }
}

export async function pauseDevnetContainer (
  devnet: $D<'container'|'containerId'|'running'>
) {
  const container = await devnet.container
  if (container) {
    devnet.log.debug(`Stopping container:`, bold(devnet.containerId?.slice(0, 8)))
    try {
      if (await container.isRunning) await container.kill()
    } catch (e) {
      if (e.statusCode == 404) {
        devnet.log.warn(`Container ${bold(devnet.containerId?.slice(0, 8))} not found`)
      } else {
        throw e
      }
    }
  }
  devnet.running = false
}
