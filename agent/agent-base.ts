/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Error as BaseError } from '@hackbg/oops'
import { Console, bold, colors } from '@hackbg/logs'
import type { Chain } from './agent-chain'
import type {
  Deployment, ContractInstance, ContractClient
} from './agent-contract'

const { red, green, gray } = colors

export { bold, colors, timestamp } from '@hackbg/logs'
export * from '@hackbg/into'
export * from '@hackbg/hide'
export * from '@hackbg/many'
export * from '@hackbg/4mat'
export * from '@hackbg/dump'

/** A class constructor. */
export interface Class<T, U extends unknown[]> { new (...args: U): T }

/** A 128-bit integer. */
export type Uint128 = string

/** A 256-bit integer. */
export type Uint256 = string

/** A 128-bit decimal fraction. */
export type Decimal = string

/** A 256-bit decimal fraction. */
export type Decimal256 = string

/** A moment in time. */
export type Moment = number

/** A period of time. */
export type Duration = number

/** A contract's full unique on-chain label. */
export type Label = string

/** Part of a Label */
export type Name = string

/** A code hash, uniquely identifying a particular smart contract implementation. */
export type CodeHash = string

/** A code ID, identifying uploaded code on a chain. */
export type CodeId = string

/** A transaction message that can be sent to a contract. */
export type Message = string|Record<string, unknown>

/** A transaction hash, uniquely identifying an executed transaction on a chain. */
export type TxHash = string

/** An address on a chain. */
export type Address = string

export function addZeros (n: number|Uint128, z: number): Uint128 {
  return `${n}${[...Array(z)].map(() => '0').join('')}`
}

/** The default Git ref when not specified. */
export const HEAD = 'HEAD'

/** A gas fee, payable in native tokens. */
export interface IFee { amount: readonly ICoin[], gas: Uint128 }

/** Represents some amount of native token. */
export interface ICoin { amount: Uint128, denom: string }

/** A constructable gas fee in native tokens. */
export class Fee implements IFee {
  amount: ICoin[] = []
  constructor (
    amount: Uint128|number, denom: string, public gas: string = String(amount)
  ) {
    this.add(amount, denom)
  }
  add = (amount: Uint128|number, denom: string) =>
    this.amount.push({ amount: String(amount), denom })
}

/** Represents some amount of native token. */
export class Coin implements ICoin {
  readonly amount: string
  constructor (amount: number|string, readonly denom: string) {
    this.amount = String(amount)
  }
}

/** Error kinds. */
class FadromaError extends BaseError {
  /** Thrown when a required parameter is missing. */
  static Missing: typeof FadromaError_Missing
  /** Thrown when an invalid value or operation is at hand. */
  static Invalid: typeof FadromaError_Invalid
  /** Thrown when an operation fails. */
  static Failed: typeof FadromaError_Failed
  /** Thrown when the control flow reaches unimplemented areas. */
  static Unimplemented = this.define('Unimplemented', (info: string) => {
    return 'Not implemented' + (info ? `: ${info}` : '')
  })
}

class FadromaError_Missing extends FadromaError.define(
  'Missing', (msg='a required parameter was missing') => msg as string
) {
  static Address = this.define('Address', () => 'no address')
  static Agent = this.define('Agent', (info?: any) => `no agent${info?`: ${info}`:``}`)
  static Artifact = this.define('Artifact', () => "no artifact url")
  static Builder = this.define('Builder', () => `no builder`)
  static Chain = this.define('Chain', () => "no chain")
  static ChainId = this.define('ChainId', () => "no chain id specified")
  static CodeId = this.define('CodeId', (info?: any) => `no code id${info?`: ${info}`:``}`)
  static CodeHash = this.define('CodeHash', () => "no code hash")
  static Crate = this.define('Crate', () => `no crate specified`)
  static DeployFormat = this.define("DeployFormat", () => `no deployment format`)
  static DeployStore = this.define("DeployStore", () => `no deployment store`)
  static DeployStoreClass = this.define("DeployStoreClass", () => `no deployment store class`)
  static Deployment = this.define("Deployment", () => `no deployment`)
  static DevnetImage = this.define("DevnetImage", () => `no devnet image`)
  static InitMsg = this.define('InitMsg', (info?: any) => `no init message${info?`: ${info}`:``}`)
  static Label = this.define('Label', (info?: any) => `no label${info?`: ${info}`:``}`)
  static Name = this.define("Name", () => "no name")
  static Uploader = this.define('Uploader', () => "no uploader")
  static Workspace = this.define('Workspace', () => "no workspace")
}

class FadromaError_Invalid extends FadromaError.define(
  'Invalid', (msg='an invalid value was provided') => msg as string
) {
  static Message = this.define('Message', () => {
    return 'messages must have exactly 1 root key'
  })
  static Label = this.define('Label', (label: string) => {
    return `can't set invalid label: ${label}`
  })
  static Batching = this.define('Batching', (op: string) => {
    return `invalid when batching: ${op}`
  })
  static Hashes = this.define('Hashes', () => {
    return 'passed both codeHash and code_hash and they were different'
  })
  static Value = this.define('Value', (x: string, y: string, a: any, b: any) => {
    return `wrong ${x}: ${y} was passed ${a} but fetched ${b}`
  })
  static WrongChain = this.define('WrongChain', () => {
    return 'tried to instantiate a contract that is uploaded to another chain'
  })
}

class FadromaError_Failed extends FadromaError.define(
  'Failed', (msg='an action failed') => msg as string
) {
  static Upload = this.define('Upload',
    (args) => 'upload failed.',
    (err, args) => Object.assign(err, args||{})
  )
  static Init = this.define('Init', (id: any) => {
    return `instantiation of code id ${id} failed.`
  })
}

export const Error = Object.assign(FadromaError, {
  Missing: FadromaError_Missing,
  Invalid: FadromaError_Invalid,
  Failed:  FadromaError_Failed
})

class AgentConsole extends Console {
  constructor (label: string = 'Fadroma') {
    super(label)
    this.label = label
  }
  emptyBatch () {
    return this.warn('Tried to submit batch with no messages')
  }
  waitingForBlock (height: number, elapsed?: number) {
    return this.log(`Waiting for block > ${bold(String(height))}...`, elapsed ? `${elapsed}ms elapsed` : '')
  }
  batchMessages (msgs: any, N: number) {
    this.info(`Messages in batch`, `#${N}:`)
    for (const msg of msgs??[]) this.info(' ', JSON.stringify(msg))
    return this
  }
  batchMessagesEncrypted (msgs: any, N: number) {
    this.info(`Encrypted messages in batch`, `#${N}:`)
    for (const msg of msgs??[]) this.info(' ', JSON.stringify(msg))
    return this
  }
  deployment (deployment: Deployment, name = deployment?.name) {
    if (!deployment) return this.info('(no deployment)')
    const contracts = Object.fromEntries(deployment.entries())
    const len = Math.max(40, Object.keys(contracts).reduce((x,r)=>Math.max(x,r.length),0))
    const count = Object.values(contracts).length
    if (count <= 0) return this.info(`${name} is an empty deployment`)
    this.info()
    this.info(`${bold(String(count))} unit(s) in deployment ${bold(name)}:`)
    for (const name of Object.keys(contracts).sort()) {
      this.info()
      this.receipt(name, contracts[name], len)
    }
    this.info()
    return this
  }
  receipt (name: string, receipt?: any, len?: number) {
    let { address, codeHash, codeId, crate, repository } = receipt || {}
    this.info(`  ${bold(name       || gray('(no name)'))     }`)
    this.info(`  addr: ${bold(address    || gray('(no address)'))  }`)
    this.info(`  hash: ${bold(codeHash   || gray('(no code hash)'))}`)
    this.info(`  code: ${bold(codeId)    || gray('(no code id)')   }`)
    this.info(`  repo: ${bold(repository || gray('(no repo)'))     }`)
    this.info(`  crate: ${bold(crate     || gray('(no crate)'))    }`)
    return this
  }
}

export { AgentConsole as Console }
