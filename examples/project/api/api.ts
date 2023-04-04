import { Client, Deployment } from '@fadroma/agent'

export default class MyProject extends Deployment {
  name = this.contract({ name: "name", crate: "name", client: Name })
  contracts = this.contract({ name: "contracts", crate: "contracts", client: Contracts })
}

export class Name extends Client {
  // myTx    = (arg1, arg2) => this.execute({myTx:{arg1, arg2}})
  // myQuery = (arg1, arg2) => this.query({myQuery:{arg1, arg2}})
}

export class Contracts extends Client {
  // myTx    = (arg1, arg2) => this.execute({myTx:{arg1, arg2}})
  // myQuery = (arg1, arg2) => this.query({myQuery:{arg1, arg2}})
}
