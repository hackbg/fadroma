/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Error as BaseError } from '@hackbg/oops'
import { Console, bold, colors } from '@hackbg/logs'
import type { Chain } from './chain'
import type { Deployment } from './deploy'

const { red, green, gray } = colors

export { bold, colors, timestamp } from '@hackbg/logs'
export * from '@hackbg/into'
export * from '@hackbg/hide'
export * from '@hackbg/many'
export * from '@hackbg/4mat'
export * from '@hackbg/dump'

/** A class constructor. */
export interface Class<T, U extends unknown[]> { new (...args: U): T }

/** Helper for assigning only allowed properties of value object:
  * - safe, can't set unsupported properties 
  * - no need to state property name thrice
  * - doesn't leave `undefined`s */
export function assign <T extends {}> (
  object: T, properties: Partial<T> & any = {}, allowed: string|Array<keyof T>|Set<keyof T>
) {
  if (typeof allowed === 'string') {
    allowed = assign.allowed.get(allowed) as Set<keyof T>
  }
  if (!allowed) {
    throw new Error(`no list of allowed properties when constructing ${object.constructor.name}`)
  }
  for (const property of allowed) {
    if (property in properties) object[property] = properties[property]
  }
}

/** Allowlist for value object below. */
assign.allowed = new Map<string, Set<string|number|symbol>>()

/** Add properties to the allow list for a given value object class. */
assign.allow = <T>(name: string, props: Array<keyof T>) => {
  const allowedProperties = assign.allowed.get(name) || new Set()
  for (const prop of props) allowedProperties.add(prop)
  assign.allowed.set(name, allowedProperties)
}

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

/** A transaction message that can be sent to a contract. */
export type Message = string|Record<string, unknown>

/** An address on a chain. */
export type Address = string

/** A transaction hash, uniquely identifying an executed transaction on a chain. */
export type TxHash = string

/** Error kinds. */
class FadromaError extends BaseError {
  /** Thrown when a required parameter is missing. */
  static Missing: typeof FadromaError_Missing
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

export const Error = Object.assign(FadromaError, {
  Missing: FadromaError_Missing,
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
