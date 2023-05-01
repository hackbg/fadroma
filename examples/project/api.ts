import { Client, Deployment } from '@fadroma/agent'

export default class ExampleDeployment extends Deployment {
  contract1 = this.contract({ name: "contract1", crate: "contract1", client: ExampleContract })
}

export class ExampleContract extends Client {
  // myTx    = (arg1, arg2) => this.execute({myTx:{arg1, arg2}})
  // myQuery = (arg1, arg2) => this.query({myQuery:{arg1, arg2}})
}
