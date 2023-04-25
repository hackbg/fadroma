import { bold, colors } from '@hackbg/logs'
import type {
  Address, Message, Label, Name, CodeId, CodeHash, Chain, Deployment,
  Contract, Instantiable, Instantiated, Client
} from './index'
import { Error } from '@hackbg/oops'

/** Error kinds. */
export default class FadromaError extends Error {

  /** Throw this when the control flow reached unimplemented areas. */
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
