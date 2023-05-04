import { Client, Deployment } from '@fadroma/agent'

export default class MyProject extends Deployment {
  test1 = this.contract({
    name: "test1",
    crate: "test1",
    client: Test1,
    initMsg: async () => ({})
  })
  test2 = this.contract({
    name: "test2",
    crate: "test2",
    client: Test2,
    initMsg: async () => ({})
  })

  // Add contract with::
  //   contract = this.contract({...})
  //
  // Add contract from fadroma.json with:
  //   contract = this.template('name').instance({...})

}

export class Test1 extends Client {
  // Implement methods calling the contract here:
  //
  // async myTx (arg1, arg2) {
  //   return await this.execute({ my_tx: { arg1, arg2 }})
  // }
  // async myQuery (arg1, arg2) {
  //   return await this.query({ my_query: { arg1, arg2 } })
  // }
  //
  // or like this:
  //
  // myTx = (arg1, arg2) => this.execute({my_tx:{arg1, arg2}})
  // myQuery = (arg1, arg2) => this.query({my_query:{arg1, arg2}})
  //
}


export class Test2 extends Client {
  // Implement methods calling the contract here:
  //
  // async myTx (arg1, arg2) {
  //   return await this.execute({ my_tx: { arg1, arg2 }})
  // }
  // async myQuery (arg1, arg2) {
  //   return await this.query({ my_query: { arg1, arg2 } })
  // }
  //
  // or like this:
  //
  // myTx = (arg1, arg2) => this.execute({my_tx:{arg1, arg2}})
  // myQuery = (arg1, arg2) => this.query({my_query:{arg1, arg2}})
  //
}
