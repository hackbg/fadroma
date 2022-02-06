import type { ContractMessage } from './Core'
import type { Contract } from './Contract'
import type { Agent } from './Agent'

export abstract class Client {
  constructor (
    readonly agent:    Agent,
    readonly address:  string,
    readonly codeHash: string
  ) {
    if (!agent) {
      throw new Error('@fadroma/ops/Client: no agent')
    }
  }
  protected query   = (msg: ContractMessage) =>
    this.agent.query(this, msg)
  protected execute = (msg: ContractMessage) =>
    this.agent.execute(this, msg)
}

//export abstract class Executor {
  //constructor (readonly client?: ContractClient) {}
//}

//export abstract class AugmentedContract<
  //Executor extends TransactionExecutor,
  //Querier  extends QueryExecutor
//> extends BaseContract {

  //[>* Class implementing transaction methods. <]
  //Transactions?: new (contract: Contract, agent: Agent) => Executor

  //[>* Get a Transactions instance bound to the current contract and agent <]
  //tx (agent: Agent = this.agent || this.creator) {
    //if (!this.Transactions) {
      //throw new Error('[@fadroma/ops] define the Transactions property to use this method')
    //}
    //return new (this.Transactions)(this, agent)
  //}

  //[>* Class implementing query methods. <]
  //Queries?: new (contract: Contract, agent: Agent) => Querier

  //[>* Get a Queries instance bound to the current contract and agent <]
  //q (agent: Agent = this.agent || this.creator) {
    //if (!this.Queries) {
      //throw new Error('[@fadroma/ops] define the Queries property to use this method')
    //}
    //return new (this.Queries)(this, agent)
  //}

//}

//export class TransactionExecutor {
  //constructor (
    //readonly contract: Contract,
    //readonly agent:    Agent
  //) {}

  //protected execute (msg: ContractMessage) {
    //return this.agent.execute(this.contract, msg)
  //}
//}

//export class QueryExecutor {
  //constructor (
    //readonly contract: Contract,
    //readonly agent:    Agent
  //) {}

  //protected query (msg: ContractMessage) {
    //return this.agent.query(this.contract, msg)
  //}
//}
