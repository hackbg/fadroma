/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Error } from '@hackbg/oops'
import { Console, Logged, bold, colors } from '@hackbg/logs'

class FadromaError extends Error {}

export { FadromaError as Error }

export const pickRandom = <T>(set: Set<T>): T => [...set][Math.floor(Math.random()*set.size)]

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

export { Console, Logged, bold, colors, randomColor, timestamp } from '@hackbg/logs'
export * from '@hackbg/into'
export * from '@hackbg/hide'
export * from '@hackbg/4mat'
export * from '@hackbg/dump'
