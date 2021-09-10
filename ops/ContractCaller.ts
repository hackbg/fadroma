import { backOff } from 'exponential-backoff'
import { ContractInit } from './ContractInit'

export abstract class ContractCaller extends ContractInit {

  private backoffOptions = {
    retry (error: any, attempt: number) {
      if (error.message.includes('500')) {
        console.warn(`Error 500, retry #${attempt}...`)
        return true }
      if (error.message.includes('502')) {
        console.warn(`Error 502, retry #${attempt}...`)
        return true }
      else {
        return false } } }

  private backoff (fn: ()=>Promise<any>) {
    return backOff(fn, this.backoffOptions) }

  /** Query the contract. */
  query (method = "", args = null, agent = this.instantiator) {
    return this.backoff(() => agent.query(this, method, args)) }

  /** Execute a contract transaction. */
  execute (
    method = "", args = null, memo: string = '',
    amount: Array<any> = [], fee: any = undefined, agent = this.instantiator
  ) {
    return this.backoff(() => agent.execute(this, method, args, memo, amount, fee)) }

  /** Create a temporary copy of a contract with a different agent */
  /*copy = (agent: Agent) => { // FIXME runtime typecheck fails silently
    return isAgent(agent) ? new BaseContract({ ...this, agent })
                          : new BaseContract(this); };*/ }
