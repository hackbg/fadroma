import type { Message } from './Core'
import type { Contract } from './Contract'
import type { Agent } from './Agent'

export abstract class Client {

  agent:    Agent
  address:  string
  codeHash: string

  constructor (options = {}) {
    Object.assign(this, options)
    if (!this.address) {
      console.warn(
        `@fadroma/ops/Contract: `+
        `No contract instance provided. ` +
        `Constructing blank ${this.constructor.name}. ` +
        `Transactions and queries not possible.`
      )
    }
    if (!this.agent) {
      console.warn(
        `@fadroma/ops/Contract: `+
        `No agent provided. ` +
        `Constructing blank ${this.constructor.name}. ` +
        `Transactions and queries not possible.`
      )
    }
  }

  protected query   = (msg: Message) =>
    this.agent.query(this, msg)

  protected execute = (msg: Message) =>
    this.agent.execute(this, msg)

  client (agent: Agent) {
    const Client = (this.constructor as ClientConstructor<typeof this>)
    return new Client({
      agent,
      address:  this.address,
      codeHash: this.codeHash
    })
  }

}

export interface ClientConstructor<C extends Client> {
  new (options: {
    agent?:    Agent
    address?:  string
    codeHash?: string
  }): C
}
