import type { Message } from './Core'
import type { Agent } from './Agent'

export abstract class Client {

  readonly agent: Agent
  address:  string
  codeHash: string
  label:    string

  constructor (options = {}) {
    Object.assign(this, options)
    if (!this.address) {
      console.warn(
        `@fadroma/ops/Client: `+
        `No contract instance provided. ` +
        `Constructing blank ${this.constructor.name}. ` +
        `Transactions and queries not possible.`
      )
    }
    if (!this.agent) {
      console.warn(
        `@fadroma/ops/Client: `+
        `No agent provided. ` +
        `Constructing blank ${this.constructor.name}. ` +
        `Transactions and queries not possible.`
      )
    }
  }

  async populate () {
    this.label = await this.agent.getLabel(this.address)
  }

  protected query   = (msg: Message) =>
    this.agent.query(this, msg)

  protected execute = (msg: Message, funds: any[] = []) =>
    this.agent.execute(this, msg, funds)

  switchAgent = (agent: Agent) => new (this.constructor as ClientConstructor<typeof this>)({
    ...this,
    agent,
  })

}

export interface ClientConstructor<C extends Client> {
  new (options: {
    agent?:    Agent
    address?:  string
    codeHash?: string
  }): C
}
