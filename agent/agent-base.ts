import { Error } from '@hackbg/oops'
import { Console, bold, colors } from '@hackbg/logs'
import type {
  Address, Message, Label, CodeId, CodeHash, Chain, Deployment,
  Contract, Instantiable, Instantiated, Client
} from './agent'

export { bold, colors, timestamp } from '@hackbg/logs'
export * from '@hackbg/into'
export * from '@hackbg/over'
export * from '@hackbg/hide'
export * from '@hackbg/many'
export * from '@hackbg/4mat'

export type Name = string

/** A class constructor. */
export interface Class<T, U extends unknown[]> {
  new (...args: U): T
}

export function prop <T> (host: object, property: string, value: T) {
  Object.defineProperty(host, property, {
    get () { return value },
    set (value) { return prop(host, property, value) },
    enumerable: true,
    configurable: true,
  })
}

/** Error kinds. */
export class FadromaError extends Error {
  /** Throw this when the control flow reaches unimplemented areas. */
  static Unimplemented = this.define('Unimplemented',
    (info?: string) => 'Not implemented' +
      (info ? `: ${info}` : ''))
  static UploadFailed = this.define('UploadFailed',
    () => 'Upload failed.')
  static InitFailed = this.define('InitFailed',
    (id: any) => `Instantiation of code id ${id} failed.`)
  static CantInit_NoName = this.define("NoName",
    () => "Can't instantiate a contract without specifying a name.")
  static CantInit_NoAgent = this.define('NoAgent',
    (id?: string) => "Can't instantiate a contract without specifying an agent."
      + (id ? ` (contract: ${id})`: ''))
  static CantInit_NoCodeId = this.define('CantInit_NoCodeId',
    (id?: string) => "Can't instantiate a contract without specifying a code ID"
      + (id ? ` (contract: ${id})`: ''))
  static CantInit_NoLabel = this.define('CantInit_NoLabel',
    (id?: string) => "Can't instantiate a contract without specifying its label."
      + (id ? ` (contract: ${id})`: ''))
  static CantInit_NoMessage = this.define('CantInit_NoMessage',
    (id?: string) => "Can't instantiate a contract without passing an init message."
      + (id ? ` (contract: ${id})`: ''))
  static DifferentHashes = this.define('DifferentHashes',
    () => 'Passed an object with codeHash and code_hash both different')
  static DeployManyFailed = this.define('DeployManyFailed',
    (e: any) => 'Deploy of multiple contracts failed. ' + e?.message??'')
  static InvalidLabel = this.define('InvalidLabel',
    (label: string) => `Can't set invalid label: ${label}`)
  static NoAgent = this.define('NoAgent',
    () => "Missing agent.")
  static NoBundleAgent = this.define('NoBundleAgent',
    () => "Missing agent for bundle.")
  static NoArtifact = this.define('NoArtifact',
    () => "No code id and no artifact to upload")
  static NoArtifactURL = this.define('NoArtifactURL',
    () => "Still no artifact URL")
  static NoBuilder = this.define('NoBuilder',
    () => `No builder specified.`)
  static NoBuilderNamed = this.define('NoBuilderNamed',
    (id: string) => `No builder with id "${id}". Make sure @fadroma/ops is imported`)
  static NoUploaderNamed = this.define('NoUploaderNamed',
    (id: string) => `No uploader with id "${id}". Make sure @fadroma/ops is imported`)
  static NoAddress = this.define('NoAddress',
    () => 'No address provided')
  static NoChain = this.define('NoChain',
    () => "No chain specified")
  static NoChainId = this.define('NoChainId',
    () => "No chain ID specified")
  static NoCodeHash = this.define('NoCodeHash',
    () => "No code hash")
  static NoContext = this.define('NoContext',
    () => "Missing deploy context.")
  static NoCrate = this.define('NoCrate',
    () => `No crate specified for building`)
  static NoCreator = this.define('NoCreator',
    (name?: string) => `Creator agent not set for task: ${name}.`)
  static NoDeployment = this.define("NoDeployment",
    (name?: string) => name
      ? `No deployment, can't find contract by name: ${name}`
      : "Missing deployment")
  static NoDeployStore = this.define("NoDeployStore",
    () => `Can't save - no deployment store is provided.`)
  static NoFetch = this.define('NoFetch',
    () => 'Global fetch is unavailable')
  static NoName = this.define("NoName",
    () => "No name.")
  static NoSource = this.define('NoSource',
    () => "No artifact and no source to build")
  static NoTemplate = this.define('NoTemplate',
    () => "Tried to create Contract with nullish template")
  static NoUploader = this.define('NoUploader',
    () => "No uploader specified")
  static NoUploaderAgent  = this.define('NoUploaderAgent',
    () => "No uploader agent specified")
  static NoPredicate  = this.define('NoPredicate',
    () => "No match predicate specified")
  static NotFound = this.define('NotFound',
    (kind: string, name: string, deployment: string, message: string = '') =>
      (`${kind} "${name}" not found in deployment "${deployment}". ${message}`))
  static ProvideBuilder = this.define('ProvideBuilder',
    (id: string) => `Provide a "${id}" builder`)
  static ProvideUploader = this.define('ProvideUploader',
    (id: string) => `Provide a "${id}" uploader`)
  static Unpopulated = this.define('Unpopulated',
    () => "template.codeId and template.codeHash must be defined to use template.asLink")
  static ExpectedAddress = this.define('ExpectedAddress', (name: string) =>
    `${name} has no address and can't operate.`)
  static ExpectedAgent = this.define('ExpectedAgent', (name: string) =>
    `${name} has no agent and can't operate. `)
  static ValidationFailed = this.define('ValidationFailed',
    (kind: string, name: string, expected: any, actual: any) =>
      `Wrong ${kind}: ${name} was passed ${expected} but fetched ${actual}`)
  static NameOutsideDevnet = this.define('NameOutsideDevnet',
    () => 'Chain#getAgent: getting agent by name only supported for devnets')
  static BalanceNoAddress = this.define('BalanceNoAddress',
    () => 'Agent#getBalance: what address?')
  static NotInBundle = this.define('NotInBundle',
    (op: string) => `Operation disallowed inside bundle: ${op}`)
  static EmptyBundle = this.define('EmptyBundle',
    () => 'Trying to submit bundle with no messages')
  static LinkNoTarget = this.define('LinkNoTarget',
    () => "Can't create inter-contract link with no target")
  static LinkNoAddress = this.define('LinkNoAddress',
    () => "Can't link to contract with no address")
  static LinkNoCodeHash = this.define('LinkNoCodeHash',
    () => "Can't link to contract with no code hash")
  static InvalidMessage = this.define('InvalidMessage',
    () => 'Messages must have exactly 1 root key')
  static NoVersion = this.define('NoVersion',
    (name: string) => `${name}: specify version`)
}

export class FadromaConsole extends Console {

  constructor (label: string = 'Fadroma') {
    super(label)
    this.label = label
  }

  object (obj?: Object) {
    let report = `---`
    if (obj) {
      report += `\n${bold(obj?.constructor?.name??'Object')}:`
      for (const x in obj) {
        let k: any = colors.dim(`${x}:`.padEnd(15))
        let v: any = obj[x as keyof typeof obj]
        if (typeof v === 'function') {
          v = bold(v.name ? `[function ${v.name}]` : `[function]`)
        } if (v instanceof Array && v.length === 0) {
          v = colors.gray('[empty array]')
        } else if (v && typeof v.toString === 'function') {
          v = bold(v.toString())
        } else if (v) {
          try {
            v = bold(v)
          } catch (e) {
            v = bold('[something]')
          }
        } else {
          v = colors.gray('[empty]')
        }
        report += `\n  ` + k + ' ' + v
      }
    } else {
      report += `\n[empty]`
    }
    console.log(report)
  }

  deployment (deployment: Deployment, name = deployment?.name) {
    if (deployment) {
      const { state = {}, name } = deployment
      let contracts: string|number = Object.values(state).length
      contracts = contracts === 0 ? `(empty)` : `(${contracts} contracts)`
      const len = Math.max(40, Object.keys(state).reduce((x,r)=>Math.max(x,r.length),0))
      const count = Object.values(state).length
      if (count > 0) {
        this.info(`${bold(String(count))} contract(s) in deployment ${bold(name)}:`)
        this.br()
        for (const name of Object.keys(state).sort()) {
          this.receipt(name, state[name], len)
          this.br()
        }
      } else {
        this.info(`No contracts in deployment ${bold(name)}.`)
      }
    } else {
      this.info('There is no selected deployment.')
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
    name = bold(name)
    address = bold(address)
    codeHash = bold(codeHash)
    codeId = bold(codeId)
    crate = bold(crate)
    this.info(`name: ${name}`)
    this.info(`addr: ${address}`)
    this.info(`hash: ${codeHash}`)
    this.info(`code: ${codeId}`)
    this.info(`repo: ${repository}`)
    this.info(`crate: ${crate}`)
  }

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

  afterDeploy <C extends Client> (contract: Partial<Contract<C>>) {
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

  deployFailed (e: Error, template: Instantiable, name: Label, msg: Message) {
    this.error(`Deploy of ${bold(name)} failed:`)
    this.error(`${e?.message}`)
    this.deployFailedContract(template)
    this.error(`Init message: `)
    this.error(`  ${JSON.stringify(msg)}`)
  }

  deployManyFailed (template: Instantiable, contracts: any[] = [], e: Error) {
    this.error(`Deploy of multiple contracts failed:`)
    this.error(bold(e?.message))
    this.error()
    this.deployFailedContract(template)
    for (const [name, init] of contracts) {
      this.error(`${bold(name)}: `)
      for (const key in init as object) {
        this.error(`  ${bold((key+':').padEnd(18))}`, init[key as keyof typeof init])
      }
    }
  }

  deployFailedContract (template?: Instantiable) {
    if (!template) return this.error(`  No template was provided.`)
    this.error(`Code hash:`, bold(template.codeHash||''))
    this.error(`Chain ID: `, bold(template.chainId ||''))
    this.error(`Code ID:  `, bold(template.codeId  ||''))
  }

  saving (name: string, state: object) {
    this.log('Saving deployment', bold(name))
    //this.log.log(Object.keys(state).join(', '))
  }

  warnUrlOverride (a: any, b: any) {
    this.warn(`node.url "${a}" overrides chain.url "${b}"`)
  }

  warnIdOverride (a: any, b: any) {
    this.warn(`node.chainId "${a}" overrides chain.id "${b}"`)
  }

  warnNodeNonDevnet () {
    this.warn(`Chain#devnet: only applicable if Chain#mode is Devnet`)
  }

  warnNoAgent (name: string) {
    this.warn(`${name}: no agent; actions will fail until agent is set`)
  }

  warnNoAddress (name: string) {
    this.warn(`${name}: no address; actions will fail until address is set`)
  }

  warnNoCodeHash (name: string) {
    this.warn(`${name}: no codeHash; actions may be slow until code hash is set`)
  }

  warnNoCodeHashProvided (address: string, realCodeHash: string) {
    this.warn(`Code hash not provided for ${address}. Fetched: ${realCodeHash}`)
  }

  warnCodeHashMismatch (address: string, expected: string|undefined, fetched: string) {
    this.warn(`Code hash mismatch for ${address}: expected ${expected}, fetched ${fetched}`)
  }

  warnSaveNoStore (name: string) {
    this.warn(`Not saving: store not set`)
  }

  warnSaveNoChain (name: string) {
    this.warn(`Not saving: chain not set`)
  }

  warnNotSavingMocknet (name: string) {
    this.warn(`Not saving: mocknet is not stateful (yet)`)
  }

  confirmCodeHash (address: string, codeHash: string) {
    this.info(`Confirmed code hash of ${address}: ${codeHash}`)
  }

  waitingForNextBlock (height: number) {
    this.log(`Waiting for block height to increment beyond ${height}...`)
  }

  warnEmptyBundle () {
    this.warn('Tried to submit bundle with no messages')
  }

  bundleMessages = (msgs: any, N: number) => {
    this.info(`Messages in bundle`, `#${N}:`)
    for (const msg of msgs??[]) this.info(' ', JSON.stringify(msg))
  }

  bundleMessagesEncrypted = (msgs: any, N: number) => {
    this.info(`Encrypted messages in bundle`, `#${N}:`)
    for (const msg of msgs??[]) this.info(' ', JSON.stringify(msg))
  }

}

export {
  FadromaError as Error,
  FadromaConsole as Console
}
