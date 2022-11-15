import { CommandsConsole } from '@hackbg/komandi'
import { bold, colors } from '@hackbg/konzola'
import type { Address, Message } from './core-tx'
import type { Name, Label } from './core-labels'
import type { CodeId, CodeHash } from './core-code'
import type { Chain } from './core-chain'
import type { Deployment } from './core-deployment'
import type { Instantiable, Instantiated } from './core-contract'
import { CustomError } from '@hackbg/konzola'

/** Error kinds. */
export class ClientError extends CustomError {
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
    (id: string) => `No builder with id "${id}". Make sure @fadroma/build is imported`)
  static NoUploaderNamed = this.define('NoUploaderNamed',
    (id: string) => `No uploader with id "${id}". Make sure @fadroma/deploy is imported`)
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

  static NoInitCodeId = this.define('NoInitCodeId',
    () => "Missing init code id")
  static NoInitLabel = this.define('NoInitLabel',
    () => "Missing init label")
  static NoInitMessage = this.define('NoInitMessage',
    () => "Missing init message")

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

/** Logging. */
export class ClientConsole extends CommandsConsole {

  constructor (name: string = 'Fadroma') {
    super(name)
    this.name = name
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
    this.br()
    if (deployment) {
      const { state = {}, name } = deployment
      let contracts: string|number = Object.values(state).length
      contracts = contracts === 0 ? `(empty)` : `(${contracts} contracts)`
      const len = Math.max(40, Object.keys(state).reduce((x,r)=>Math.max(x,r.length),0))
      this.info('Active deployment:'.padEnd(len+2), bold(name), contracts)
      const count = Object.values(state).length
      if (count > 0) {
        this.br()
        this.info('Contracts in this deployment:')
        for (const name of Object.keys(state)) {
          this.receipt(name, state[name], len)
        }
      } else {
        this.info('No contracts in this deployment.')
      }
    } else {
      this.info('There is no selected deployment.')
    }
    this.br()
  }

  receipt (name: string, receipt?: any, len?: number) {
    name    ||= '(unnamed)'
    receipt ||= {}
    len     ??= 35
    let {
      address    = colors.gray('(unspecified address)'),
      codeHash   = colors.gray('(unspecified code hash)'),
      codeId     = colors.gray('(unspecified code id)'.padEnd(len)),
      crate      = colors.gray('(unspecified crate)'.padEnd(len)),
      repository = colors.gray('(unspecified source)'.padEnd(len))
    } = receipt
    name = bold(name.padEnd(len))
    if (this.indent + len + 64 < this.width - 4) {
      codeId = bold(codeId.padEnd(len))
      crate  = bold(crate.padEnd(len))
      this.info()
      this.info(name,   '│', address)
      this.info(codeId, '│', codeHash)
      if (receipt.crate || receipt.repository) this.info(crate, repository)
    } else {
      this.info()
      this.info(name)
      this.info(address)
      this.info(codeHash)
      this.info(codeId)
    }
  }

  foundDeployedContract (address: Address, name: Name) {
    this.log(
      colors.green('Found:   '),
      bold(colors.green(address)),
      'is',
      bold(colors.green(name)),
    )
  }

  beforeDeploy <T extends Instantiable> (
    template: T,
    label:    Label,
    codeId:   CodeId   = template?.codeId   ? bold(String(template.codeId)) : colors.red('(no code id!)'),
    codeHash: CodeHash = template?.codeHash ? bold(template.codeHash)       : colors.red('(no code hash!)')
  ) {
    label = label ? bold(label) : colors.red('(missing label!)')
    this.log('Init:    ', 'code id', bold(codeId), 'as', bold(label))
  }

  afterDeploy (contract: Partial<Instantiated>) {
    const { red, green } = colors
    const name = contract?.name
      ? bold(green(contract.name))
      : bold(red('(no name)'))
    const deployment = contract?.prefix
      ? bold(green(contract.prefix))
      : bold(red('(no deployment)'))
    const address = bold(colors.green(contract?.address!))
    this.info('Deployed:', name, 'in', deployment)
    this.info('Address: ', address)
    this.info('Code hash', contract?.codeHash?colors.green(contract.codeHash):colors.red('(n/a)'))
    this.br()
  }

  deployFailed (e: Error, template: Instantiable, name: Label, msg: Message) {
    this.br()
    this.error(`Deploy of ${bold(name)} failed:`)
    this.error(`${e?.message}`)
    this.deployFailedContract(template)
    this.error(`Init message: `)
    this.error(`  ${JSON.stringify(msg)}`)
    this.br()
  }

  deployManyFailed (template: Instantiable, contracts: any[] = [], e: Error) {
    this.br()
    this.error(`Deploy of multiple contracts failed:`)
    this.error(bold(e?.message))
    this.error()
    this.deployFailedContract(template)
    for (const [name, init] of contracts) {
      this.br()
      this.error(`${bold(name)}: `)
      for (const key in init as object) {
        this.error(`  ${bold((key+':').padEnd(18))}`, init[key as keyof typeof init])
      }
    }
    this.br()
  }

  deployFailedContract (template?: Instantiable) {
    if (!template) return this.error(`  No template was provided.`)
    this.error(`Code hash:`, bold(template.codeHash||''))
    this.error(`Chain ID: `, bold(template.chainId ||''))
    this.error(`Code ID:  `, bold(template.codeId  ||''))
  }

  chainStatus ({ chain, deployments }: {
    chain?: Chain, deployments?: { active?: { name: string }, list (): string[] }
  } = {}) {
    if (!chain) return this.info('│ No active chain.')
    this.info('│ Chain type: ', bold(chain.constructor.name))
    this.info('│ Chain mode: ', bold(chain.mode))
    this.info('│ Chain ID:   ', bold(chain.id))
    this.info('│ Chain URL:  ', bold(chain.url.toString()))
    this.info('│ Deployments:', bold(String(deployments?.list().length)))
    if (!deployments?.active) return this.info('│ No active deployment.')
    this.info('│ Deployment: ', bold(String(deployments?.active?.name)))
  }

  warnUrlOverride (a: any, b: any) {
    this.warn(`node.url "${a}" overrides chain.url "${b}"`)
  }

  warnIdOverride (a: any, b: any) {
    this.warn(`node.chainId "${a}" overrides chain.id "${b}"`)
  }

  warnNodeNonDevnet () {
    this.warn(`"node" option is only applicable to devnets`)
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

  confirmCodeHash (address: string, codeHash: string) {
    this.info(`Confirmed code hash of ${address}: ${codeHash}`)
  }

  waitingForNextBlock (height: number) {
    this.info(`Waiting for block height to increment beyond ${height}...`)
  }

  warnEmptyBundle () {
    this.warn('Tried to submit bundle with no messages')
  }

}
