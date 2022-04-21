import type { Instance, Message } from './Core'
import type { Executor } from './Agent'

export interface ClientConfig {
  agent?:    Executor
  address?:  string
  codeHash?: string
  label?:    string
}

export interface ClientConstructor<C extends Client> {
  new (options: ClientConfig): C
}

export class Client implements Instance {

  agent:    Executor
  chainId:  string
  codeId:   string
  codeHash: string
  address:  string
  label:    string

  constructor (options: ClientConfig = {}) {
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

  protected execute = (msg: Message, memo?, funds?) =>
    this.agent.execute(this, msg, memo, funds)

  switchAgent = (agent: Executor) => new (this.constructor as ClientConstructor<typeof this>)({
    ...this,
    agent,
  })

}
