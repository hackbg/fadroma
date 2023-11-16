/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Error } from '@hackbg/oops'
import { Console, bold, colors } from '@hackbg/logs'
import type { Deployment } from './deploy'

const { red, green, gray } = colors

export { bold, colors, timestamp } from '@hackbg/logs'
export * from '@hackbg/into'
export * from '@hackbg/hide'
export * from '@hackbg/many'
export * from '@hackbg/4mat'
export * from '@hackbg/dump'

/** Helper for assigning only allowed properties of value object:
  * - safe, can't set unsupported properties 
  * - no need to state property name thrice
  * - doesn't leave `undefined`s */
export function assign <T extends {}> (
  object: T, properties: Partial<T> & any = {}, allowed: Array<keyof T>|Set<keyof T>
) {
  if (!allowed || (typeof allowed !== 'object')) {
    throw new Error(`no list of allowed properties when constructing ${object.constructor.name}`)
  }
  for (const property of allowed) {
    if (property in properties) object[property] = properties[property]
  }
}

export class Logged {
  log: Console
  constructor (properties?: Partial<Logged>) {
    this.log = properties?.log ?? new Console(this.constructor.name)
  }
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
class FadromaError extends Error {}

export {
  Console,
  FadromaError as Error
}
