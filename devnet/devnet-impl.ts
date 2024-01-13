/** Actually private definitions.
  * Not part of the TS *or* JS public API,
  * i.e. not accessible at all outside the package. */

import deasync from 'deasync'
import { onExit } from 'gracy'
import portManager from '@hackbg/port'
import $, { JSONFile, XDG } from '@hackbg/file'
import { Console, bold, colors, randomBase16, randomColor } from '@fadroma/agent'
import { OCIImage, OCIConnection } from '@fadroma/oci'
import type { Path } from '@hackbg/file'
import type { Connection, Identity } from '@fadroma/agent'
import type { default as DevnetContainer } from './devnet-base'
import type { APIMode } from './devnet-base'

const ENTRYPOINT_MOUNTPOINT = '/devnet.init.mjs'

type $D<T extends keyof DevnetContainer> = Pick<DevnetContainer, T>

export function initPort (devnet: $D<'nodePortMode'|'nodePort'>) {
  if (devnet.nodePortMode) {
    devnet.nodePort ??= defaultPorts[devnet.nodePortMode]
  }
  return devnet
}

export function initContainer (devnet: $D<'log'|'container'>) {
  devnet.container.log.label = devnet.log.label
  if (!devnet.container.image) {
    devnet.container.image = new OCIImage()
  }
  devnet.container.image.log.label = devnet.log.label
  if (!devnet.container.image.engine) {
    devnet.container.image.engine = new OCIConnection()
  }
  return devnet
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
  return devnet
}

export function initLogger (
  devnet: $D<'chainId'|'log'>
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
  return devnet
}

export function initState (
  devnet:  $D<'stateDir'|'stateFile'|'chainId'>,
  options: Partial<$D<'stateDir'|'stateFile'>>
) {
  devnet.stateDir = $(options.stateDir ?? $(
    XDG({ expanded: true, subdir: 'fadroma' }).data.home, 'devnets', devnet.chainId
  ).path)
  devnet.stateFile = $(options.stateFile ?? $(
    devnet.stateDir, 'devnet.json'
  )).as(JSONFile)
  //if ($(devnet.stateDir).isDirectory() && devnet.stateFile.isFile()) {
    //try {
      //const state = (devnet.stateFile.as(JSONFile).load() || {}) as Record<any, unknown>
      //// Options always override stored state
      //options = { ...state, ...options }
    //} catch (e) {
      //console.error(e)
      //throw new Error(
        //`failed to load devnet state from ${devnet.stateFile.path}: ${e.message}`
      //)
    //}
  //}
  return devnet
}

export function initDynamicUrl (
  devnet: $D<'log'|'url'|'nodeProtocol'|'nodeHost'|'nodePort'>
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
  return devnet
}

export async function createDevnetContainer (
  devnet:
    & Parameters<typeof saveDevnetState>[0]
    & Parameters<typeof containerOptions>[0]
    & $D<'container'|'verbose'|'initScript'|'url'>
): Promise<void> {
  if (await devnet.container.exists) {
    devnet.log(`Found`, bold(devnet.chainId), `in container`, bold(devnet.container.id.slice(0, 8)))
  } else {
    if (devnet.verbose) {
      devnet.log.debug('Creating container for', bold(devnet.chainId))
    }
    // ensure we have image and chain id
    if (!devnet.container.image) {
      throw new Error("Can't create devnet without container image")
    }
    if (!devnet.chainId) {
      throw new Error("Can't create devnet without chain ID")
    }
    // if port is unspecified or taken, increment
    devnet.nodePort = await portManager.getFreePort(devnet.nodePort)
    // create container
    if (devnet.verbose) {
      devnet.log(`Creating devnet`, bold(devnet.chainId), `on`, bold(String(devnet.url)))
    }
    devnet.container.name      = devnet.chainId
    devnet.container.options   = containerOptions(devnet)
    devnet.container.command   = devnet.initScript ? [ENTRYPOINT_MOUNTPOINT] : []
    devnet.container.log.label = devnet.log.label
    await devnet.container.create()
    //setExitHandler(devnet)
    // set id and save
    if (devnet.verbose) {
      devnet.log.debug(`Created container:`, bold(devnet.container.id.slice(0, 8)))
    }
    await saveDevnetState(devnet)
    if (devnet.verbose) {
      devnet.log.debug(`Saved devnet receipt.`)
    }
  }
}

export async function deleteDevnetContainer (
  devnet: $D<'log'|'container'|'stateDir'|'paused'> & Parameters<typeof forceDelete>[0]
): Promise<void> {
  devnet.log('Deleting...')
  let container
  try {
    container = await devnet.container
  } catch (e) {
    if (e.statusCode === 404) {
      devnet.log(`No container found`, bold(devnet.container.id.slice(0, 8)))
    } else {
      throw e
    }
  }
  if (container && await container?.isRunning) {
    if (await container.isRunning) {
      await devnet.paused
    }
    await container.remove()
  }
  const state = $(devnet.stateDir)
  const path = state.shortPath
  try {
    if (state.exists()) {
      devnet.log(`Deleting ${path}...`)
      //state.delete()
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

/** Write the state of the devnet to a file.
  * This saves the info needed to respawn the node */
async function saveDevnetState (devnet: $D<
  'platformName'|'platformVersion'|'chainId'|'container'|'nodePort'
> & {
  stateFile: { save (data: object) }
}) {
  devnet.stateFile.save({
    platformName:    devnet.platformName,
    platformVersion: devnet.platformVersion,
    image:           devnet.container.image.name,
    container:       devnet.container.id,
    nodePort:        devnet.nodePort,
  })
}

export async function startDevnetContainer (
  devnet: Parameters<typeof createDevnetContainer>[0] & $D<
    |'log'|'running'|'container'|'waitString'|'waitMore'
    |'nodeHost'|'nodePort'|'chainId'|'waitPort'|'created'
  >
) {
  if (!devnet.running) {
    devnet.running = true
    devnet.log.debug(`Starting container`)
    try {
      await devnet.container.start()
    } catch (e) {
      devnet.log.warn(e)
      // Don't throw if container already started.
      // TODO: This must be handled in @fadroma/oci
      if (e.code !== 304) throw e
    }
    devnet.log.debug('Waiting for container to say:', bold(devnet.waitString))
    await devnet.container.waitLog(devnet.waitString, (_)=>true, true)
    devnet.log.debug('Waiting for', bold(String(devnet.waitMore)), 'seconds...')
    await new Promise(resolve=>setTimeout(resolve, devnet.waitMore))
    //await Dock.Docker.waitSeconds(devnet.waitMore)
    await devnet.waitPort({ host: devnet.nodeHost, port: Number(devnet.nodePort) })
  } else {
    devnet.log.log('Container already started:', bold(devnet.chainId))
  }
}

export async function pauseDevnetContainer (
  devnet: $D<'log'|'container'|'running'>
) {
  const container = await devnet.container
  if (container) {
    devnet.log.debug(`Stopping container:`, bold(devnet.container.id.slice(0, 8)))
    try {
      if (await container.isRunning) await container.kill()
    } catch (e) {
      if (e.statusCode == 404) {
        devnet.log.warn(`Container ${bold(devnet.container.id.slice(0, 8))} not found`)
      } else {
        throw e
      }
    }
  }
  devnet.running = false
}

export async function connect <C extends Connection, I extends Identity> (
  devnet:      $D<'chainId'|'started'|'url'|'running'> & Parameters<typeof getIdentity>[0],
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
  devnet: $D<'log'|'stateDir'|'created'|'started'>,
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
    'chainId'|'initScript'|'stateDir'|'nodePort'
  > & Parameters<typeof containerEnvironment>[0]
) {
  const Binds: string[] = []
  if (devnet.initScript) {
    Binds.push(`${devnet.initScript.path}:${ENTRYPOINT_MOUNTPOINT}:ro`)
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
    'log'|'chainId'|'gasToken'|'nodeBinary'|'nodePortMode'|'nodePort'|'genesisAccounts'|'verbose'
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
    devnet.log.warn(`Unknown port mode "${devnet.nodePortMode}", devnet may not be accessible.`)
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
  devnet: $D<'log'|'onExit'|'paused'|'deleted'|'chainId'|'nodePort'|'exitHandler'|'container'>
) {
  if (!devnet.exitHandler) {
    devnet.log.debug('Registering exit handler')
    onExit(devnet.exitHandler = defineExitHandler(devnet), { logger: false })
  } else {
    devnet.log.warn('Exit handler already registered')
  }
}

function defineExitHandler (
  devnet: Parameters<typeof setExitHandler>[0]
) {
  let called = false
  return async function exitHandler (
    this: Parameters<typeof setExitHandler>[0],
    ...args: unknown[]
  ) {
    if (called) {
      this.log.trace('Exit handler called more than once')
      return
    }
    called = true
    this.log.debug('Running exit handler', { args })
    if (this.onExit === 'delete') {
      this.log.log(`Exit handler: stopping and deleting ${this.chainId}`)
      await this.paused
      this.log.log(`Stopped ${this.chainId}`)
      await this.deleted
      this.log.log(`Deleted ${this.chainId}`)
    } else if (this.onExit === 'pause') {
      this.log.log(`Stopping ${this.chainId}`)
      await this.paused
      this.log.log(`Stopped ${this.chainId}`)
    } else {
      this.log.log(
        'Devnet is running on port', bold(String(this.nodePort)),
        `from container`, bold(this.container.id.slice(0,8))
      ).info('To remove the devnet:'
      ).info('  $ npm run devnet reset'
      ).info('Or manually:'
      ).info(`  $ docker kill`, this.container.id.slice(0,8),
      ).info(`  $ docker rm`, this.container.id.slice(0,8),
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

/** Run the cleanup container, deleting devnet state even if emitted as root. */
export async function forceDelete (
  devnet: $D<'stateDir'|'container'|'chainId'|'log'>
) {
  const path = $(devnet.stateDir).shortPath
  devnet.log('Running cleanup container for', path)
  const cleanupContainer = await devnet.container.image.run({
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
  //$(devnet.stateDir).delete()
}

export function initContainerState (devnet: DevnetContainer) {
  const defineGetter = (name, get) => Object.defineProperty(devnet, name, {
    enumerable:   true,
    configurable: true,
    get
  })
  defineGetter('created', () => {
    const creating = createDevnetContainer(devnet)
    defineGetter('created', () => creating)
    return creating
  })
  defineGetter('started', () => {
    const starting = startDevnetContainer(devnet)
    defineGetter('started', () => starting)
    return starting
  })
}

//type State = 'missing'|'creating'|'paused'|'starting'|'running'|'pausing'|'deleting'

//type Transition = 'create'|'start'|'pause'|'delete'

//type StateMap = Record<State, Record<Transition, Array<State|Function>>>

//function defineContainerStates (
  //createContainer = createDevnetContainer,
  //deleteContainer = deleteDevnetContainer,
  //startContainer  = startDevnetContainer,
  //pauseContainer  = pauseDevnetContainer,
//) {
  //return {
    //missing: {
      //create: ['creating', createContainer, 'created'],
      //start:  ['creating', createContainer, 'starting', startContainer, 'running'],
      //pause:  [],
      //delete: [],
    //},
    //creating: {
      //create: [],
      //start:  [],
      //pause:  ['pausing', pauseContainer, 'paused'],
      //delete: ['pausing', pauseContainer, 'paused', deleteContainer, 'missing'],
    //},
    //paused: {
      //create: [],
      //start:  ['starting', startContainer, 'running'],
      //pause:  [],
      //delete: ['deleting', deleteContainer, 'deleted']
    //},
    //starting: {
      //create: [],
      //start:  [],
      //pause:  ['pausing', pauseContainer, 'paused'],
      //delete: ['pausing', pauseContainer, 'paused', deleteContainer, 'missing'],
    //},
    //running: {
      //create: [],
      //start:  [],
      //pause:  ['pausing', pauseContainer, 'paused'],
      //delete: ['pausing', pauseContainer, 'paused', deleteContainer, 'missing'],
    //},
    //pausing: {
      //create: [],
      //start:  ['starting', startContainer, 'started'],
      //pause:  [],
      //delete: ['deleting', deleteContainer, 'missing'],
    //},
    //deleting: {
      //create: ['creating', createContainer, 'created'],
      //start:  ['creating', createContainer, 'created'],
      //pause:  [],
      //delete: []
    //}
  //}
//}

//export function initContainerState (
  //devnet:
    //& Parameters<typeof createDevnetContainer>[0]
    //& Parameters<typeof deleteDevnetContainer>[0]
    //& Parameters<typeof startDevnetContainer>[0]
    //& Parameters<typeof pauseDevnetContainer>[0]
//): typeof devnet & {
  //readonly created: Promise<void>
  //readonly deleted: Promise<void>
  //readonly started: Promise<void>
  //readonly paused:  Promise<void>
//} {
  //let stateAtom: Promise<ContainerState> = Promise.resolve('missing')

  //const transition = (cb: (s: ContainerState)=>Promise<ContainerState>) =>
    //() => stateAtom = stateAtom.then(cb)

  //const doCreate = transition(async state => {
    //if (state === 'missing') {
      ////await createDevnetContainer(devnet)
      //state = 'paused'
    //}
    //return state
  //})

  //const doStart = transition(async state => {
    //console.log('doStart 1')
    //if (state === 'missing') {
      //console.log('doStart 2')
      //state = await doCreate()
    //}
    //if (state === 'paused') {
      ////await startDevnetContainer(devnet)
      //state = 'running'
    //}
    //return state
  //})

  //const doPause = transition(async state => {
    //if (state === 'running') {
      //await pauseDevnetContainer(devnet)
      //state = 'paused'
    //}
    //return state
  //})

  //const doDelete = transition(async state => {
    //if (state === 'running') {
      //state = await doPause()
    //}
    //if (state === 'paused') {
      //await deleteDevnetContainer(devnet)
      //state = 'missing'
    //}
    //return state
  //})

  //console.log({doCreate,doStart,doPause,doDelete})

  //Object.defineProperties(devnet, {
    //created: { configurable: true, get () { console.log('get created'); return doCreate() } },
    //deleted: { configurable: true, get () { console.log('get deleted'); return doDelete() } },
    //started: { configurable: true, get () { console.log('get started'); return doStart() } },
    //stopped: { configurable: true, get () { console.log('get stopped'); return doPause() } },
  //})

  //return devnet as typeof devnet & {
    //readonly created: Promise<void>
    //readonly deleted: Promise<void>
    //readonly started: Promise<void>
    //readonly paused:  Promise<void>
  //}
//}
