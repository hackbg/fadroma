import { Client, Deployment } from '@fadroma/agent'

export default class MyProject extends Deployment {
  contract1 = this.contract({ name: "contract", crate: "contract", client: Contract1 })
}

export class Contract1 extends Client {
  // myTx    = (arg1, arg2) => this.execute({myTx:{arg1, arg2}})
  // myQuery = (arg1, arg2) => this.query({myQuery:{arg1, arg2}})
}
