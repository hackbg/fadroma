import { loadJSON, JSONDirectory } from './system'
import { Chain, Contract, Agent, isAgent } from './types'
import { ScrtBuilder, ScrtUploader } from './builder'
import Ajv from 'ajv'
import { backOff } from 'exponential-backoff'

export class ContractCode {
  buildImage = 'enigmampc/secret-contract-optimizer:latest'

  protected code: {
    workspace?: string
    crate?:     string
    artifact?:  string
    codeHash?:  string
  } = {}

  /** Path to source workspace */
  get workspace () { return this.code.workspace }
  /** Name of source crate within workspace */
  get crate () { return this.code.crate }
  /** Name of compiled binary */
  get artifact () { return this.code.artifact }
  /** SHA256 hash of the uncompressed artifact */
  get codeHash () { return this.code.codeHash }

  /** Compile a contract from source */
  async build (workspace?: string, crate?: string) {
    if (workspace) this.code.workspace = workspace
    if (crate) this.code.crate = crate
    return this.code.artifact = await new ScrtBuilder().buildOrCached({
      workspace: this.workspace,
      crate:     this.crate }) } }

export class ContractUpload extends ContractCode {
  protected blob: {
    chain?:    Chain
    agent?:    Agent
    codeId?:   number
    codeHash?: string
    receipt?: {
      codeId:             number
      compressedChecksum: string
      compressedSize:     string
      logs:               Array<any>
      originalChecksum:   string
      originalSize:       number
      transactionHash:    string
    }
  } = {}

  constructor (agent?: Agent) {
    super()
    this.blob.agent = agent }

  /** The chain where the contract is deployed. */
  get chain () { return this.blob.chain }
  /** The agent that deployed the contract. */
  get uploader () { return this.blob.agent }
  /** The result of the upload transaction. */
  get uploadReceipt () { return this.blob.receipt }
  /** The auto-incrementing id of the uploaded code */
  get codeId () { return this.blob.codeId }
  /** The auto-incrementing id of the uploaded code */
  get codeHash () { return this.blob.codeHash }

  /** Upload the contract to a specified chain as a specified agent. */
  async upload (chainOrAgent: Agent|Chain) {
    if (chainOrAgent instanceof Chain) {
      this.blob.chain = chainOrAgent
      this.blob.agent = await this.blob.chain.getAgent() }
    else if (chainOrAgent instanceof Agent) {
      this.blob.agent = chainOrAgent
      this.blob.chain = this.blob.agent.chain }
    else {
      throw new Error('You must provide a Chain or Agent to use for deployment') }
    if (!this.artifact) {
      await this.build() }
    const uploader = new ScrtUploader(this.chain, this.uploader)
    this.blob.receipt  = await uploader.uploadOrCached(this.artifact)
    this.blob.codeId   = this.blob.receipt.codeId
    this.blob.codeHash = this.blob.receipt.originalChecksum
    return this.blob.receipt } }

export class ContractInit extends ContractUpload {
  protected init: {
    prefix?:  string
    agent?:   Agent
    address?: string
    label?:   string
    msg?:     any
    tx?: {
      contractAddress: string
      data:            string
      logs:            Array<any>
      transactionHash: string } } = {}

  constructor (agent: Agent) {
    super(agent)
    this.init.agent = agent }

  /** The agent that initialized this instance of the contract. */
  get instantiator () { return this.init.agent }
  /** The on-chain address of this contract instance */
  get address () { return this.init.address }
  /** A reference to the contract in the format that ICC callbacks expect. */
  get link () { return { address: this.address, code_hash: this.codeHash } }
  /** A reference to the contract as an array */
  get linkPair () { return [ this.address, this.codeHash ] as [string, string] }
  /** The on-chain label of this contract instance.
    * The chain requires these to be unique.
    * If a prefix is set, it is appended to the label. */
  get label () { return this.init.prefix
    ? `${this.init.prefix}/${this.init.label}`
    : this.init.label }
  /** The message that was used to initialize this instance. */
  get initMsg () { return this.init.msg }
  /** The response from the init transaction. */
  get initTx () { return this.init.tx }
  /** The full result of the init transaction. */
  get initReceipt () {
    return { label:    this.label
           , codeId:   this.codeId
           , codeHash: this.codeHash
           , initTx:   this.initTx } }

  protected backoffOptions = {
    retry (error: any, attempt: number) {
      if (error.message.includes('502')) {
        console.warn(`Error 502, retry #${attempt}...`)
        return true }
      else {
        return false } } }

  protected backoff (fn: ()=>Promise<any>) {
    return backOff(fn, this.backoffOptions) }

  async instantiate (agent?: Agent) {
    this.init.agent = agent
    if (!this.codeId) {
      throw new Error('Contract must be uploaded before instantiating') }
    this.init.tx = await this.backoff(() =>
      this.instantiator.instantiate(this.codeId, this.label, this.initMsg))
    this.init.address = this.init.tx.contractAddress
    this.save() }

  /** Used by Ensemble to save multiple instantiation receipts in a subdir. */
  setPrefix (prefix: string) {
    this.init.prefix = prefix
    return this }

  /** Save the contract's instantiation receipt in the instances directory for this chain.
    * If prefix is set, creates subdir grouping contracts with the same prefix. */
  save () {
    let dir = this.chain.instances
    if (this.init.prefix) dir = dir.subdir(this.init.prefix, JSONDirectory).make()
    dir.save(this.init.label, this.initReceipt)
    return this } }

export class ContractCaller extends ContractInit {

  /** Query the contract. */
  query (method = "", args = null, agent = this.instantiator) {
    return this.backoff(() => agent.query(this, method, args)) }

  /** Execute a contract transaction. */
  execute (
    method = "", args = null, memo: string,
    amount: Array<any>, fee: any, agent = this.instantiator
  ) {
    return this.backoff(() => agent.execute(this, method, args, memo, amount, fee)) }

  /** Create a temporary copy of a contract with a different agent */
  /*copy = (agent: Agent) => { // FIXME runtime typecheck fails silently
    return isAgent(agent) ? new BaseContract({ ...this, agent })
                          : new BaseContract(this); };*/ }

/** A contract with auto-generated methods for invoking
 *  queries and transactions */
export class ContractAPI extends ContractCaller implements Contract {
  protected schema: {
    initMsg?:        any
    queryMsg?:       any
    queryResponse?:  any
    handleMsg?:      any
    handleResponse?: any
  }

  private ajv = getAjv()

  private validate: {
    initMsg?:        Function
    queryMsg?:       Function
    queryResponse?:  Function
    handleMsg?:      Function
    handleResponse?: Function
  } = {}

  q:  Record<string, Function>
  tx: Record<string, Function>

  constructor (schema: Record<string, any>, agent?: Agent) {
    super(agent)
    this.schema = schema
    this.q  = new Factory(this, this.schema?.queryMsg).create()
    this.tx = new Factory(this, this.schema?.handleMsg).create()
    for (const msg of ['initMsg', 'queryMsg', 'queryResponse', 'handleMsg', 'handleResponse']) {
      if (this.schema[msg]) this.validate[msg] = this.ajv.compile(this.schema[msg]) } } }

//export class ContractWithSchema extends BaseContractAPI {
  //q:  Record<string, Function>
  //tx: Record<string, Function>
  //constructor(agent: Agent, options: any = {}, schema: any) {
    //if (schema && schema.initMsg) {
      //const ajv = getAjv();
      //const validate = ajv.compile(schema.initMsg);
      //if (!validate(options.initMsg)) {
        //const err = JSON.stringify(validate.errors, null, 2)
        //throw new Error(`Schema validation for initMsg returned an error: \n${err}`); } }
    //super(agent)
    //this.q  = new Factory(schema.queryMsg,  this).create()
    //this.tx = new Factory(schema.handleMsg, this).create() } }

export const loadSchemas = (
  base:    string,
  schemas: Record<string,string> = {}
) =>
  Object.entries(schemas).reduce((output, [name, path])=>
    Object.assign(output, { [name]: loadJSON(path, base) }), {})

/** Convert snake case to camel case */
const camelCaseString = (str: string): string => {
  return str.replace(/(\_\w)/g, function (m) {
    return m[1].toUpperCase(); }); };

/** Wrap the class in proxy in order to work dynamically. */
export function Wrapper (schema: any, instance: any) {
  return new Factory(schema, instance).create(); };

const clone = (x: any) => JSON.parse(JSON.stringify(x))

/** Wrapper factory that will create all the methods */
export class Factory {

  caller:  string
  methods: Array<any> = []
  ajv:     Ajv = getAjv()

  constructor(
    public contract: { copy?: Function, label: string },
    public schema:   Record<any, any>
  ) {
    if (typeof schema !== "object" || schema === null) {
      throw new Error("Schema must be an object"); }
    this.schema = clone({ ...schema, type: "object", $schema: undefined, });
    const title = this.schema.title.toLowerCase()
    if (title.startsWith("query")) {
      this.caller = "query"; }
    else if (title.startsWith("handle")) {
      this.caller = "execute"; } }

  /** Make a call on an agent and allow it to be overriden with custom */
  getContract(agent: Agent): any {
    if (isAgent(agent) && typeof this.contract['copy'] === "function") {
      return this.contract['copy'](agent); }
    return this.contract; }

  /** Create the object with generated methods */
  create(): Record<any, any> {
    this.parse();
    const handlers: Record<any, any> = {};
    for (const {method} of this.methods) {
      handlers[method] = handlers[camelCaseString(method)] = (
        args:     Record<any, any>,
        agent:    Agent,
        memo:     string,
        transfer: Array<any>,
        fee:      any
      ) => this.run(method, args, agent, memo, transfer, fee); }
    return handlers; }

  /** Parse the schema and generate method definitions */
  parse() {
    if (Array.isArray(this.schema.anyOf)) {
      for (const item of this.schema.anyOf) {
        if (item.type === "string") {https://getsol.us/home/
          this.onlyMethod(item); }
        else if (item.type === "object") {
          this.methodWithArgs(item); } } }
    if (this.schema.type === "string" && Array.isArray(this.schema.enum)) {
      this.onlyMethod(this.schema); } }

  /** Parse schema items that only have a method call without arguments */
  onlyMethod (item: Record<any, any>) {
    if (Array.isArray(item.enum)) {
      for (const m of item.enum) {
        this.methods.push({
          method: m,
          description: item.description,
          string: true,
          emptyArgs: true, }); } } }

  /** Parse schema item that has arguments */
  methodWithArgs(item: Record<any, any>) {
    if (Array.isArray(item.required)) {
      const m = item.required[0];

      // This is to handle those enum variants that have arguments but it's only an empty object
      if (
        Object.keys(item.properties[m]).length === 1 &&
        item.properties[m].type === "object"
      ) {
        this.methods.push({
          method: m,
          description: item.description,
          string: false,
          emptyArgs: true, }); }
      else {
        this.methods.push({
          method: m,
          description: item.description,
          string: false,
          emptyArgs: false, }); } } }

  /** Run schema validation on passed arguments */
  validate(action: Record<any, any>, args: Record<any, any>) {
    const validate = this.ajv.compile(this.schema);
    const message = { [action.method]: args || {} };
    if (!validate(message)) {
      const msg =  {
        title: this.schema.title,
        label: this.contract.label,
        calledAction: { ...action, message },
        validationErrors: validate.errors, }
      throw new Error(`Arguments validation returned error:\n${JSON.stringify(msg, null, 2)}`) } }

  /** Try to find method in the parsed stack and run it */
  run(
    method: string, args: any, agent: Agent,
    memo: string, transferAmount: Array<any>, fee: any
  ) {
    for (const action of this.methods) {
      if (action.method === method) {
        if (isAgent(args) && !isAgent(agent)) {
          agent = args;
          args = {}; }
        if (action.string) {
          return this.callString(action, agent, memo, transferAmount, fee); }
        else {
          return this.callObject(action, args, agent, memo, transferAmount, fee); } } }
    // This is unreachable
    throw new Error(`Method '${method}' couldn't be found in schema definition`); }

  /** Make a call to a simple function on a contract */
  private callString(
    action: Record<any, any>, agent: Agent,
    memo: string, transferAmount: Array<any>, fee: any
  ) {
    const contract = this.getContract(agent);
    return contract[this.caller](action.method, null, undefined, memo, transferAmount, fee); }

  /** Make a call to a method that receives arguments */
  private callObject(
    action: Record<any, any>, args: Record<any, any>, agent: Agent,
    memo: string, transferAmount: Array<any>, fee: any
  ) {
    if (action.emptyArgs) {
      args = {}; }
    else {
      this.validate(action, args); }
    const contract = this.getContract(agent);
    return contract[this.caller](action.method, args, undefined, memo, transferAmount, fee); } }

/** Creates Ajv instance for schema validation*/
export function getAjv (): Ajv {
  const ajv = new Ajv({ strict: false } as any);
  addNumberType("int8",  127, -128);
  addNumberType("int16", 32767, -32768);
  addNumberType("int32", 2147483647, -2147483648);
  addNumberType("int64", BigInt("9223372036854775807"), BigInt("-9223372036854775808"));
  return ajv;

  // Add type validation for intN and add automatically uintN
  function addNumberType (name: string, max: number|bigint, min: number|bigint) {
    ajv.addFormat(name, {
      type:     "number",
      validate: (x: any) => (!isNaN(x) && x >= min && x <= max) });
    ajv.addFormat(`u${name}`, {
      type:     "number",
      validate: (x: any) => (!isNaN(x) && x >= 0 && x <= max)}); }; };
