import { Console, Error } from './agent-base'
import type { Class, Address, Message } from './agent-base'
import type { Agent, Chain } from './agent-chain'
import { ContractInstance } from './agent-deploy'

/** A constructor for a ContractClient subclass. */
export interface ContractClientClass<C extends ContractClient> extends
  Class<C, [Address|Partial<ContractInstance>, Agent|undefined]> {}

/** ContractClient: interface to the API of a particular contract instance.
  * Has an `address` on a specific `chain`, usually also an `agent`.
  * Subclass this to add the contract's methods. */
export class ContractClient {
  log = new Console(this.constructor.name)

  contract: ContractInstance

  agent?: Agent

  constructor (contract: Address|Partial<ContractInstance>, agent?: Agent) {
    this.agent = agent
    if (typeof contract === 'string') {
      this.contract = new ContractInstance({ address: contract })
    } else if (contract instanceof ContractInstance) {
      this.contract = contract
    } else {
      this.contract = new ContractInstance(contract)
    }
  }

  /** The chain on which this contract exists. */
  get chain (): Chain|undefined {
    return this.agent?.chain
  }

  /** Execute a query on the specified contract as the specified Agent. */
  query <U> (msg: Message): Promise<U> {
    if (!this.agent) {
      throw new Error.Missing.Agent(this.constructor?.name)
    }
    if (!this.contract.address) {
      throw new Error.Missing.Address()
    }
    return this.agent.query(this.contract as ContractInstance & { address: Address }, msg)
  }

  /** Execute a transaction on the specified contract as the specified Agent. */
  execute (message: Message, options: Parameters<Agent["execute"]>[2] = {}): Promise<void|unknown> {
    if (!this.agent) {
      throw new Error.Missing.Agent(this.constructor?.name)
    }
    if (!this.contract.address) {
      throw new Error.Missing.Address()
    }
    return this.agent.execute(
      this.contract as ContractInstance & { address: Address },
      message,
      options
    )
  }

}
