import { CommandsConsole } from '@hackbg/komandi'
import { bold } from '@hackbg/konzola'
import type { Contract, Label, DeployArgs, Message, Chain, ContractMetadata } from './client'
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
  static NoArtifactURL = this.define('NoArtifactUrl',
    () => "Still no artifact URL")
  static NoBuilder = this.define('NoBuilder',
    () => `No builder specified.`)
  static NoBuilderNamed = this.define('NoBuilderNamed',
    (id: string) => `No builder with id "${id}". Make sure @fadroma/build is imported`)
  static NoUploaderNamed = this.define('NoUploaderNamed',
    (id: string) => `No uploader with id "${id}". Make sure @fadroma/deploy is imported`)
  static NoChain = this.define('NoChain',
    () => "This agent has no chain")
  static NoChainId = this.define('NoChainId',
    () => "No chain ID specified")
  static NoCodeHash = this.define('NoCodeHash',
    () => "No code hash")
  static NoContext = this.define('NoUploadInitContext',
    () => "Missing deploy context.")
  static NoCrate = this.define('NoCrate',
    () => `No crate specified for building`)
  static NoCreator = this.define('NoCreator',
    (name?: string) => `Creator agent not set for task: ${name}.`)
  static NoDeployment = this.define("NoDeployment",
    (name?: string) => name
      ? `No deployment, can't find contract by name: ${name}`
      : "Missing deployment")
  static NoInitMessage = this.define('NoInitMessage',
    () => "Missing init message")
  static NoName = this.define("NoContractName",
    () => "No name.")
  static NoSource = this.define('NoSource',
    () => "No artifact and no source to build")
  static NoTemplate = this.define('NoTemplate',
    () => "Tried to create Contract with nullish template")
  static NoUploader = this.define('NoUploader',
    () => "No uploader specified")
  static NoUploaderAgent  = this.define('NoUploaderAgent',
    () => "No uploader agent specified")
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
    `${name} has no address and can't operate.` +
    ` Pass an address with "new ${name}(agent, address)" ` +
    ` or "new ${name}({ address })"`)
  static ExpectedAgent = this.define('ExpectedAgent', (name: string) =>
    `${name} has no agent and can't operate. `+
    `Pass an address when calling "new ${name}(agent, addr)"`)
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
  object (obj?: Object) {
    let report = `---`
    if (obj) {
      report += `\n${obj?.constructor?.name??Object}`
      for (const x in obj) {
        let v: any = obj[x as keyof typeof obj]
        if (typeof v === 'function') {
          v = bold(v.name ? `[function ${v.name}]` : `[function]`)
        } if (v instanceof Array && v.length === 0) {
          v = '[empty array]'
        } else if (v && typeof v.toString === 'function') {
          v = bold(v.toString())
        } else if (v) {
          try {
            v = bold(v)
          } catch (e) {
            v = bold('[something]')
          }
        } else {
          v = '[empty]'
        }
        report += `\n  ` + `${x}:`.padEnd(15) + ' ' + v
      }
    } else {
      report += `\n[empty]`
    }
    console.log(report)
  }
  contract (meta: ContractMetadata) {
    this.object(meta)
  }
  beforeDeploy (template: Contract<any>, label: Label) {
    return this.info(
      'Deploy   ', bold(label),
      'from code id', bold(String(template.codeId ||'(unknown)')),
      'hash', bold(String(template.codeHash||'(unknown)'))
    )
  }
  afterDeploy (contract: Partial<Contract<any>>) {
    return this.info(
      'Deployed ', bold(contract.name!), 'is', bold(contract.address!),
      'from code id', bold(contract.codeId!)
    )
  }
  deployFailed (e: Error, template: Contract<any>, name: Label, msg: Message) {
    this.error()
    this.error(`  Deploy of ${bold(name)} failed:`)
    this.error(`    ${e.message}`)
    this.deployFailedContract(template)
    this.error()
    this.error(`  Init message: `)
    this.error(`    ${JSON.stringify(msg)}`)
    this.error()
  }
  deployManyFailed (template: Contract<any>, contracts: DeployArgs[] = [], e: Error) {
    this.error()
    this.error(`  Deploy of multiple contracts failed:`)
    this.error(`    ${e.message}`)
    this.deployFailedContract(template)
    this.error()
    this.error(`  Configs: `)
    for (const [name, init] of contracts) {
      this.error(`    ${bold(name)}: `, JSON.stringify(init))
    }
    this.error()
  }
  deployFailedContract (template?: Contract<any>) {
    this.error()
    if (!template) return this.error(`  No template was provided.`)
    this.error(`  Contract:   `)
    this.error(`    Chain ID: `, bold(template.chainId ||''))
    this.error(`    Code ID:  `, bold(template.codeId  ||''))
    this.error(`    Code hash:`, bold(template.codeHash||''))
  }
  chainStatus ({ chain, deployments }: {
    chain?: Chain, deployments?: { active?: { name: string }, list (): string[] }
  }) {
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
  waitingForNextBlock () {
    this.info('Waiting for next block...')
  }
}
