import { resolve, writeFile, readFileSync, loadJSON } from "@fadroma/sys"
//import { Agent, isAgent } from '@fadroma/agent'

import { Factory, getAjv } from "./wrapper"

/** Interface to a contract instance.
  * Can be subclassed with schema to auto-generate methods
  * TODO connect to existing contract */
export class Contract {

  agent:    Agent
  label:    string
  codeId:   number
  codeHash: string
  initMsg:  any
  initTx:   any

  /** Create an object representing a remote smart contract instance. */
  constructor(options: any = {}) {
    const { agent, label, codeId, codeHash, initMsg, initTx } = options;
    Object.assign(this, { agent, label, codeId, codeHash, initMsg, initTx }); }

  /** Get the address of the contract. */
  get address() {
    return this.initTx.contractAddress; }

  /** Get a reference to the contract (address + code_hash)
   *  in a format matching `scrt-callback`'s `ContractInstance` */
  get reference() {
    return { address: this.address, code_hash: this.codeHash, }; }

  /** Query the contract. */
  query = (method = "", args = null, agent = this.agent) =>
    agent.query(this, method, args);

  /** Execute a contract transaction. */
  execute = (
    method = "", args = null, agent = this.agent,
    memo: string, transferAmount: Array<any>, fee: any
  ) =>
    agent.execute(this, method, args, memo, transferAmount, fee);

  /** Save the contract's instantiation receipt.*/
  save = () =>
    writeFile(this.receiptPath, JSON.stringify(this.receipt, null, 2), "utf8");

  /** Create a temporary copy of a contract with a different agent */
  copy = (agent: Agent) => {
    return isAgent(agent) ? new Contract({ ...this, agent })
                          : new Contract(this); };

  /** Get the path to the contract receipt for the contract's code. */
  get receiptPath() {
    return resolve(this.network.instances, `${this.label}.json`); }

  /** Get the contents of the contract instantiation receipt. */
  get receipt() {
    return {
      label: this.label,
      codeId: this.codeId,
      codeHash: this.codeHash,
      initTx: this.initTx, }; }

  /**Get an interface to the network where the contract is deployed.*/
  get network() {
    return this.agent.network; } }

/** A contract with auto-generated methods for invoking
 *  queries and transactions */
export class ContractWithSchema extends Contract {
  q:  Record<string, Function>
  tx: Record<string, Function>
  constructor(options: any = {}, schema: any) {
    if (schema && schema.initMsg) {
      const ajv = getAjv();
      const validate = ajv.compile(schema.initMsg);
      if (!validate(options.initMsg)) {
        const err = JSON.stringify(validate.errors, null, 2)
        throw new Error(`Schema validation for initMsg returned an error: \n${err}`); } }
    super(options)
    this.q  = new Factory(schema.queryMsg,  this).create()
    this.tx = new Factory(schema.handleMsg, this).create() } }

export const loadSchemas = (
  base:    string,
  schemas: Record<string,string> = {}
) =>
  Object.entries(schemas).reduce((output, [name, path])=>
    Object.assign(output, { [name]: loadJSON(path, base) }), {})
