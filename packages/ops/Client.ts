import type { Message } from './Core'
import type { Contract } from './Contract'
import type { Agent } from './Agent'

export abstract class Client {
  agent:    Agent
  address:  string
  codeHash: string
  constructor (options = {}) { Object.assign(this, options) }
  protected query   = (msg: Message) =>
    this.agent.query(this, msg)
  protected execute = (msg: Message) =>
    this.agent.execute(this, msg)
  client (agent: Agent) {
    return new (this.constructor as ClientConstructor<typeof this>)({
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
