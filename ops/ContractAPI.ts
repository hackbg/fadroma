import { loadJSON, writeFileSync, basename, dirname } from '@fadroma/tools'

import type { Contract } from './Contract'
import type { Agent } from './Agent'

import { ContractCaller } from './ContractCaller'
import { isAgent } from './Agent'

import Ajv from 'ajv'
import { compileFromFile } from 'json-schema-to-typescript'

/** A contract with auto-generated methods for invoking
 *  queries and transactions */
export abstract class ContractAPI extends ContractCaller implements Contract {
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
    this.q  = new SchemaFactory(this, this.schema?.queryMsg).create()
    this.tx = new SchemaFactory(this, this.schema?.handleMsg).create()
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
    //this.q  = new SchemaFactory(schema.queryMsg,  this).create()
    //this.tx = new SchemaFactory(schema.handleMsg, this).create() } }

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
  return new SchemaFactory(schema, instance).create(); };

const clone = (x: any) => JSON.parse(JSON.stringify(x))

/** Wrapper factory that will create all the methods */
export class SchemaFactory {

  caller:  string
  methods: Array<any> = []
  ajv:     Ajv = getAjv()

  constructor(
    public contract: { copy?: Function, label: string },
    public schema:   Record<any, any>
  ) {
    if (typeof schema !== "object" || schema === null) {
      throw new Error(`Schema must be an object, got: ${schema}`); }
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
        if (item.type === "string") {
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

export function schemaToTypes (...schemas: Array<string>) {
  return Promise.all(schemas.map(schema=>
    compileFromFile(schema).then(ts=>{
      const output = `${dirname(schema)}/${basename(schema, '.json')}.d.ts`
      writeFileSync(output, ts)
      console.info(`Generated ${output}`)}))) }
