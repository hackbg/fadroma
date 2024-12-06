
/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program. If not, see <http://www.gnu.org/licenses/>. **/
//import type { [>Chain, Agent, Identity, Address,<] ChainId } from '../index.ts'
//import { Logged, assign } from './Util.ts'
//import * as Token from './dlt/Token.ts'

/** Represents the backend of an [`Endpoint`](#abstract-class-endpoint), managed by us,
  * such as:
  *
  *   * Local devnet RPC endpoint.
  *   * Stub/mock implementation of chain.
  *
  * You shouldn't need to instantiate this class directly.
  * Instead, see `Connection`, `Devnet`, and their subclasses. */
//export abstract class Backend extends Logged {
  //constructor (properties?: Partial<Backend>) {
    //super(properties)
    //assign(this, properties, ["chainId"])
  //}

  //[>* The chain ID that will be passed to the devnet node. <]
  //chainId?:  ChainId
  //[>* Denomination of base gas token for this chain. <]
  //gasToken?: Token.Native

  ////abstract connect ():
    ////Promise<Chain>
  ////abstract connect (name: string):
    ////Promise<Agent>
  ////abstract connect (identity: Partial<Identity>):
    ////Promise<Agent>

  ////abstract getIdentity (name: string):
    ////Promise<{ address?: Address, mnemonic?: string }>
//}
