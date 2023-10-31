/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Console, Error } from './base'
import type { Class, Address, Message } from './base'
import type { Agent, ChainId } from './chain'
import { ContractInstance } from './deploy'

/** A constructor for a ContractClient subclass. */
export interface ContractClientClass<C extends ContractClient> extends
  Class<C, [ ...ConstructorParameters<typeof ContractClient>, ...unknown[] ]> {}

/** ContractClient: interface to the API of a particular contract instance.
  * Has an `address` on a specific `chain`, usually also an `agent`.
  * Subclass this to add the contract's methods. */
export class ContractClient {
  log = new Console(this.constructor.name)

  contract: ContractInstance

  agent?: Agent

  constructor (contract: Address|Partial<ContractInstance>, agent?: ContractClient["agent"]) {
    this.agent = agent
    if (typeof contract === 'string') {
      this.contract = new ContractInstance({ address: contract })
    } else if (contract instanceof ContractInstance) {
      this.contract = contract
    } else {
      this.contract = new ContractInstance(contract)
    }
  }

  /** Execute a query on the specified contract as the specified Agent. */
  query <Q> (message: Message): Promise<Q> {
    if (!this.agent) {
      throw new Error.Missing.Agent(this.constructor?.name)
    }
    if (!this.contract.address) {
      throw new Error.Missing.Address()
    }
    return this.agent.query<Q>(
      this.contract as ContractInstance & { address: Address }, message
    )
  }

  /** Execute a transaction on the specified contract as the specified Agent. */
  execute (message: Message, options: Parameters<Agent["execute"]>[2] = {}): Promise<unknown> {
    if (!this.agent) {
      throw new Error.Missing.Agent(this.constructor?.name)
    }
    if (!this.contract.address) {
      throw new Error.Missing.Address()
    }
    return this.agent.execute(
      this.contract as ContractInstance & { address: Address }, message, options
    )
  }

}
