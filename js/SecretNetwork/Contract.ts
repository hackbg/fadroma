import { writeFile, resolve } from '../sys.js'
import extendWithSchema from './extendWithSchema.js'

/** Interface to a contract instance.
 * Can be subclassed with schema to auto-generate methods
 * TODO connect to existing contract */
export default class SecretNetworkContract {

  network: SecretNetwork        | null;
  builder: SecretNetworkBuilder | null;
  agent:   SecretNetworkAgent   | null;

  constructor (fields={}) {
    Object.assign(this, fields)
  }

  /**Get the path to the upload receipt for the contract's code.
   */
  get receiptPath () { return resolve(this.network.instances, `${this.label}.json`) }

  /**Get an interface to the network where the contract is deployed.
   */
  get network () { return this.agent.network }

  /**Get the address of the contract.
   */
  get address () { return this.contractAddress }

  /**Tell an agent to instantiate this contract from codeId, label, and initMsg.
   */
  static async init ({ agent, codeId, label, initMsg } = {}) {
    const receipt = await agent.instantiate({codeId, label, initMsg})
    const instance = new this({ agent, ...receipt })
    await writeFile(instance.receiptPath, JSON.stringify(receipt, null, 2), 'utf8')
    return instance
  }

  /**Query the contract.
   */
  query = (method = '', args = {}, agent = this.agent) =>
    agent.query(this, method, args)

  /**Execute a contract transaction.
   */
  execute = (method = '', args = {}, agent = this.agent) =>
    agent.execute(this, method, args)

  /** Create subclass with methods based on the schema
   * TODO: validate schema and req/res arguments (with `ajv`?)
   */
  static withSchema = (schema={}) =>
    extendWithSchema(this, schema)
}
