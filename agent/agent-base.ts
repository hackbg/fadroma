import { Error as BaseError } from '@hackbg/oops'
import { Console, bold, colors } from '@hackbg/logs'
import type {
  Address, Message, Label, CodeId, CodeHash, Chain, Deployment,
  Contract, Instantiable, Instantiated, Client
} from './agent'

export { bold, colors, timestamp } from '@hackbg/logs'
export * from '@hackbg/into'
export * from '@hackbg/hide'
export * from '@hackbg/many'
export * from '@hackbg/4mat'

export type Name = string

/** The default Git ref when not specified. */
export const HEAD = 'HEAD'

/** A class constructor. */
export interface Class<T, U extends unknown[]> { new (...args: U): T }

export function prop <T> (host: object, property: string, value: T) {
  Object.defineProperty(host, property, {
    get () { return value },
    set (value) { return prop(host, property, value) },
    enumerable: true,
    configurable: true,
  })
}

/** Error kinds. */
class AgentError extends BaseError {
  /** Thrown when unsupported functionality is requested. */
  static Unsupported: typeof AgentError_Unsupported
  /** Thrown when a required parameter is missing. */
  static Missing: typeof AgentError_Missing
  /** Thrown when an invalid value or operation is at hand. */
  static Invalid: typeof AgentError_Invalid
  /** Thrown when an operation fails. */
  static Failed: typeof AgentError_Failed
  /** Thrown when the control flow reaches unimplemented areas. */
  static Unimplemented = this.define('Unimplemented', (info: string) =>
    'Not implemented' + (info ? `: ${info}` : ''))
}

class AgentError_Unsupported extends AgentError.define(
  'Unsupported', (info: string) => `Unsupported: ${info}`
) {
  /** When global Fetch API is not available, Fadroma must switch to node:fs API. */
  static Fetch = this.define('Fetch', () =>
    'Global fetch is unavailable. Use FSUploader instead of FetchUploader.')
}

class AgentError_Invalid extends AgentError.define(
  'Invalid', (msg='An invalid value was provided')=>msg as string
) {
  static Message = this.define('Message', () =>
    'Messages must have exactly 1 root key')
  static Label = this.define('Label', (label: string) =>
    `Can't set invalid label: ${label}`)
  static Batching = this.define('Batching', (op: string) =>
    `This operation is invalid when batching: ${op}`)
  static EmptyBundle = this.define('EmptyBundle', () =>
    'Trying to submit bundle with no messages')
  static Hashes = this.define('DifferentHashes', () =>
    'Passed an object with codeHash and code_hash both different')
}

class AgentError_Missing extends AgentError.define(
  'Missing', (msg='A required parameter is missing')=>msg as string
) {
  static Address = this.define('Address',
    () => 'Missing address')
  static Agent = this.define('Agent',
    (info?: any) => `Missing agent${info?`: ${info}`:``}`)
  static Artifact = this.define('Artifact',
    () => "No code id and no artifact to upload")
  static ArtifactURL = this.define('ArtifactURL',
    () => "Still no artifact URL")
  static Builder = this.define('Builder',
    () => `No builder specified.`)
  static BuilderNamed = this.define('BuilderNamed',
    (id: string) => `No builder with id "${id}". Make sure @hackbg/fadroma is imported`)
  static BundleAgent = this.define('BundleAgent',
    () => "Missing agent for bundle")
  static Chain = this.define('Chain',
    () => "No chain specified")
  static ChainId = this.define('ChainId',
    () => "No chain ID specified")
  static CodeId = this.define('CodeId',
    (info?: any) => `No code id${info?`: ${info}`:``}`)
  static CodeHash = this.define('CodeHash',
    () => "No code hash")
  static Context = this.define('Context',
    () => "Missing deploy context.")
  static Crate = this.define('Crate',
    () => `No crate specified for building`)
  static Creator = this.define('Creator',
    (name?: string) => `Creator agent not set for task: ${name}`)
  static DeployFormat = this.define("DeployFormat",
    () => `Can't save - no deployment store is provided`)
  static DeployStore = this.define("DeployStore",
    () => `Can't save - no deployment store is provided`)
  static Deployment = this.define("Deployment",
    (name?: string) => name ? `No deployment, can't find contract by name: ${name}`
                            : "Missing deployment")
  static InitMsg = this.define('InitMsg',
    (info?: any) => `A required init message was not provided${info?`: ${info}`:``}`)
  static Label = this.define('Label',
    (info?: any) => `No label${info?`: ${info}`:``}`)
  static Name = this.define("Name",
    () => "No name")
  static Predicate = this.define('Predicate',
    () => "No match predicate specified")
  static Source = this.define('Source',
    () => "No artifact and no source to build")
  static Template = this.define('Template',
    () => "Tried to create Contract with nullish template")
  static Uploader = this.define('Uploader',
    () => "No uploader specified")
  static UploaderAgent = this.define('UploaderAgent',
    () => "No uploader agent specified")
  static UploaderNamed = this.define('UploaderNamed',
    (id: string) => `No uploader with id "${id}". Make sure @hackbg/fadroma is imported`)
  static Version = this.define('Version',
    (name: string) => `${name}: specify version`)
  static LinkTarget = this.define('LinkTarget',
    () => "Can't create inter-contract link with no target")
  static LinkAddress = this.define('LinkAddress',
    () => "Can't link to contract with no address")
  static LinkCodeHash = this.define('LinkCodeHash',
    () => "Can't link to contract with no code hash")
}

class AgentError_Failed extends AgentError.define('Failed', (msg='An action failed')=>msg as string) {
  static Validation = this.define('Validation', (x: string, y: string, a: any, b: any) =>
    `Wrong ${x}: ${y} was passed ${a} but fetched ${b}`)
  static Upload = this.define('Upload', (args) =>
    'Upload failed.', (err, args) => Object.assign(err, args||{}))
  static Init = this.define('Init', (id: any) =>
    `Instantiation of code id ${id} failed.`)
  static DeployMany = this.define('DeployMany', (e: any) =>
    'Deploy of multiple contracts failed. ' + e?.message??'')
}

export const Error = Object.assign(AgentError, {
  Unsupported: AgentError_Unsupported,
  Missing:     AgentError_Missing,
  Invalid:     AgentError_Invalid,
  Failed:      AgentError_Failed
})

class AgentConsole extends Console {

  constructor (label: string = 'Fadroma') {
    super(label)
    this.label = label
  }

  warn: ({
    saveNoStore       (name: string): AgentConsole
    saveNoChain       (name: string): AgentConsole
    devnetIdOverride  (a: any, b: any): AgentConsole
    devnetUrlOverride (a: any, b: any): AgentConsole
    devnetModeInvalid (): AgentConsole
    noAgent           (name: string): AgentConsole
    noAddress         (name: string): AgentConsole
    noCodeHash        (name: string): AgentConsole
    fetchedCodeHash   (address: string, realCodeHash: string): AgentConsole
    codeHashMismatch  (address: string, expected: string|undefined, fetched: string): AgentConsole
    notSavingMocknet  (name: string): AgentConsole
    emptyBundle       (): AgentConsole
  } & ((...args: any)=>this)) = Object.assign(this.warn, {
    devnetIdOverride: (a: any, b: any) =>
      this.warn(`node.chainId "${a}" overrides chain.id "${b}"`),
    devnetUrlOverride: (a: any, b: any) =>
      this.warn(`node.url "${a}" overrides chain.url "${b}"`),
    devnetModeInvalid: () =>
      this.warn(`Chain#devnet: only applicable if Chain#mode is Devnet`), // warnNodeNonDevnet
    noAgent: (name: string) =>
      this.warn(`${name}: no agent; actions will fail until agent is set`),
    noAddress: (name: string) =>
      this.warn(`${name}: no address; actions will fail until address is set`),
    noCodeHash: (name: string) =>
      this.warn(`${name}: no codeHash; actions may be slow until code hash is set`),
    fetchedCodeHash: (address: string, realCodeHash: string) =>
      this.warn(`Code hash not provided for ${address}. Fetched: ${realCodeHash}`),
    codeHashMismatch: (address: string, expected: string|undefined, fetched: string) =>
      this.warn(`Code hash mismatch for ${address}: expected ${expected}, fetched ${fetched}`),
    saveNoStore: (name: string) =>
      this.warn(`Not saving: store not set`),
    saveNoChain: (name: string) =>
      this.warn(`Not saving: chain not set`),
    notSavingMocknet: (name: string) =>
      this.warn(`Not saving: mocknet is not stateful (yet)`),
    emptyBundle: () =>
      this.warn('Tried to submit bundle with no messages'),
  })

  error: ({
    deployFailed         (e: Error, template: Instantiable, name: Label, msg: Message): void
    deployManyFailed     (template: Instantiable, contracts?: any[], e?: Error): void
    deployFailedContract (template?: Instantiable): void
  } & ((...args: any)=>this)) = ((
    context,
    deployFailedContract = (template?: Instantiable) => {
      if (!template) return context.error(`No template was provided`)
      context.error(`Code hash:`, bold(template.codeHash||''))
      context.error(`Chain ID: `, bold(template.chainId ||''))
      context.error(`Code ID:  `, bold(template.codeId  ||''))
    }
  )=>Object.assign(context.error, {
    deployFailed: (e: Error, template: Instantiable, name: Label, msg: Message) => {
      this.error(`Deploy of ${bold(name)} failed:`)
      this.error(`${e?.message}`)
      deployFailedContract(template)
      this.error(`Init message: `)
      this.error(`  ${JSON.stringify(msg)}`)
    },
    deployManyFailed: (template: Instantiable, contracts: any[] = [], e: Error) => {
      this.error(`Deploy of multiple contracts failed:`)
      this.error(bold(e?.message))
      deployFailedContract(template)
      for (const [name, init] of contracts) {
        this.error(`${bold(name)}: `)
        for (const key in init as object) {
          this.error(`  ${bold((key+':').padEnd(18))}`, init[key as keyof typeof init])
        }
      }
    },
  }))(this)

  bundleMessages = (msgs: any, N: number) => {
    this.info(`Messages in bundle`, `#${N}:`)
    for (const msg of msgs??[]) this.info(' ', JSON.stringify(msg))
  }
  bundleMessagesEncrypted = (msgs: any, N: number) => {
    this.info(`Encrypted messages in bundle`, `#${N}:`)
    for (const msg of msgs??[]) this.info(' ', JSON.stringify(msg))
  }

  saving = (name: string, state: object) =>
    this.log('saving')
  waitingForBlock = (height: number, elapsed?: number) =>
    this.log(`waiting for block > ${height}...`, elapsed ? `${elapsed}ms elapsed` : '')
  confirmCodeHash = (address: string, codeHash: string) =>
    this.info(`Confirmed code hash of ${address}: ${codeHash}`)
  foundDeployedContract (address: Address, name: Name) {
    this.sub(name).log('Found at', bold(address))
  }

  beforeDeploy <C extends Client> (
    template: Contract<C>,
    label:    Label,
    codeId:   CodeId   = template?.codeId   ? bold(String(template.codeId)) : colors.red('(no code id!)'),
    codeHash: CodeHash = template?.codeHash ? bold(template.codeHash)       : colors.red('(no code hash!)'),
    crate:    string|undefined = template?.crate,
    revision: string|undefined = template?.revision ?? 'HEAD'
  ) {
    label = label ? bold(label) : colors.red('(missing label!)')
    let info = `${bold(label)} from code id ${bold(codeId)}`
    if (crate) info += ` (${bold(crate)} @ ${bold(revision)})`
    this.log(`init: ${info}`)
  }
  afterDeploy = <C extends Client> (contract: Partial<Contract<C>>) => {
    const { red, green } = colors
    const id = contract?.name
      ? bold(green(contract.name))
      : bold(red('(no name)'))
    const deployment = contract?.prefix
      ? bold(green(contract.prefix))
      : bold(red('(no deployment)'))
    const address = bold(colors.green(contract?.address!))
    this.info('addr:', address)
    this.info('hash:', contract?.codeHash?colors.green(contract.codeHash):colors.red('(n/a)'))
    this.info('added to', deployment)
    this.br()
  }
  deployment (deployment: Deployment, name = deployment?.name) {
    if (!deployment) return this.info('(no deployment)')
    const { contracts = {} } = deployment
    const len = Math.max(40, Object.keys(contracts).reduce((x,r)=>Math.max(x,r.length),0))
    const count = Object.values(contracts).length
    if (count <= 0) return this.info(`${name} is an empty deployment`)
    this.info(`${bold(String(count))} contract(s) in deployment ${bold(name)}:`)
    this.br()
    for (const name of Object.keys(contracts).sort()) {
      this.receipt(name, contracts[name], len)
      this.br()
    }
  }
  receipt (name: string, receipt?: any, len?: number) {
    name    ||= '(unnamed)'
    receipt ||= {}
    len     ??= 35
    let {
      address    = colors.gray('(unspecified address)'),
      codeHash   = colors.gray('(unspecified code hash)'),
      codeId     = colors.gray('(unspecified code id)'),
      crate      = colors.gray('(unspecified crate)'),
      repository = colors.gray('(unspecified source)')
    } = receipt
    this.info(`name: ${bold(name)}`)
    this.info(`addr: ${bold(address)}`)
    this.info(`hash: ${bold(codeHash)}`)
    this.info(`code: ${bold(codeId)}`)
    this.info(`repo: ${bold(repository)}`)
    this.info(`crate: ${bold(crate)}`)
  }

}

export { AgentConsole as Console }
