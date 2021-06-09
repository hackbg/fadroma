import { writeFile, resolve } from '@fadroma/utilities'
import extendWithSchema from './extendWithSchema.js'

/** Interface to a contract instance.
 * Can be subclassed with schema to auto-generate methods
 * TODO connect to existing contract */
export default class SecretNetworkContract {

  /** Create subclass with methods based on the schema
   * TODO: validate schema and req/res arguments (with `ajv`?)
   */
  static withSchema = (schema = {}) => extendWithSchema(this, schema)

  /** Create an object representing a remote smart contract instance.
   */
  constructor (options={}) {
    const { agent, label, codeId, codehash, initTx } = options
    Object.assign(this, { agent, label, codeId, codehash, initTx })
  }

  /** Get the path to the contract receipt for the contract's code.
   */
  get receiptPath () {
    return resolve(
      this.network.instances,
      `${this.label}.json`
    )
  }

  /** Get the contents of the contract receipt.
   */
  get receipt () {
    return {
      label:    this.label,
      codeId:   this.codeId,
      codeHash: this.codeHash,
      initTx:   this.initTx,
    }
  }
 
  /** Save the contract's instantiation receipt.
   */
  save = () => writeFile(
    this.receiptPath,
    JSON.stringify(this.receipt, null, 2),
    'utf8'
  )

  /**Get an interface to the network where the contract is deployed.
   */
  get network () { return this.agent.network }

  /**Get the address of the contract.
   */
  get address () { return this.contractAddress }

  /**Get a reference to the contract (address + code_hash)
   * in a format matching `scrt-callback`'s `ContractInstance`
   */
  get reference () { return { address: this.address, code_hash: this.codeHash } }

  /**Query the contract.
   */
  query = (method = '', args = {}, agent = this.agent) =>
    agent.query(this, method, args)

  /**Execute a contract transaction.
   */
  execute = (method = '', args = {}, agent = this.agent) =>
    agent.execute(this, method, args)
}
