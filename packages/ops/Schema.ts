import Ajv from 'ajv'
import { compileFromFile } from 'json-schema-to-typescript'
import { loadJSON, writeFileSync, basename, dirname, Console } from '@hackbg/tools'
import { Agent } from './Model'
import { isAgent } from './Agent'

const console = Console('@fadroma/ops/schema')

export function loadSchemas (
  base:    string,
  schemas: Record<string,string> = {}
) {
  const output = {}
  for (const [name, path] of Object.entries(schemas)) {
    try {
      output[name] = loadJSON(path, base)
    } catch (e) {
      console.warn(`Could not load schema ${name} from ${base}: ${e.message}`)
    }
  }
  return output
}

/** Convert snake case to camel case */
const camelCaseString = (str: string) =>
  str.replace(/(\_\w)/g, (m: string) =>
    m[1].toUpperCase())

type Contract = {
  copy:  Function
  label: string
}

type Schema   = {
  title?:      string,
  type?:       string,
  anyOf?:      Array<Schema>,
  description: string,
  required?:   Array<string>,
  emptyArgs?:  unknown,
  method:      string,
  string:      boolean
  properties?: Record<string, Record<string, unknown>>
}

type Handlers = Record<string, Function>

/** Wrap the class in proxy in order to work dynamically. */
export function Wrapper (instance: Contract, schema: Schema) {
  return new SchemaFactory(instance, schema).create();
}

const clone = (x: unknown) => JSON.parse(JSON.stringify(x))

/** Wrapper factory that will create all the methods */
export class SchemaFactory {

  caller?: "query"|"execute"

  methods: Array<Schema> = []

  ajv: Ajv = getAjv()

  constructor (
    public contract: Contract,
    public schema:   Schema,
  ) {

    if (typeof schema !== "object" || schema === null) {
      console.warn(`Schema must be an object, got: ${schema}`);
      return
    }

    this.schema = clone({ ...schema, type: "object", $schema: undefined, });

    const title = this.schema.title.toLowerCase()

    if (title.startsWith("query")) {
      this.caller = "query";
    } else if (title.startsWith("handle")) {
      this.caller = "execute";
    }

  }

  /** Make a call on an agent and allow it to be overriden with custom */
  getContract (agent: Agent): Contract {

    if (isAgent(agent) && typeof this.contract['copy'] === "function") {
      return this.contract['copy'](agent);
    }

    return this.contract;

  }

  /** Create the object with generated methods */
  create (): Handlers {

    const handlers: Handlers = {};

    if (typeof this.schema !== "object" || this.schema === null) {

      handlers['_ERROR_schema_must_be_an_object_'] = () => {}

      console.warn(`Schema must be an object, got: ${this.schema}`);

    } else {

      this.parse();

      for (const {method} of this.methods) {
        handlers[method] = handlers[camelCaseString(method)] = (
          args:     Record<string, unknown>,
          agent:    Agent,
          memo:     string,
          transfer: Array<unknown>,
          fee:      unknown
        ) => this.run(method, args, agent, memo, transfer, fee);
      }

    }

    return handlers;

  }

  /** Parse the schema and generate method definitions */
  parse () {

    if (Array.isArray(this.schema.anyOf)) {
      for (const item of this.schema.anyOf) {
        if (item.type === "string") {
          this.onlyMethod(item);
        } else if (item.type === "object") {
          this.methodWithArgs(item);
        }
      }
    }

    if (
      this.schema.type === "string" &&
      Array.isArray(this.schema.enum)
    ) {
      this.onlyMethod(this.schema);
    }
  }

  /** Parse schema items that only have a method call without arguments */
  onlyMethod (item: Schema) {
    if (Array.isArray(item.enum)) {
      for (const m of item.enum) {
        this.methods.push({
          method: m,
          description: item.description,
          string: true,
          emptyArgs: true,
        });
      }
    }
  }

  /** Parse schema item that has arguments */
  methodWithArgs (item: Schema) {

    if (Array.isArray(item.required)) {

      const m = item.required[0]

      // This is to handle those enum variants
      // that have arguments but it's only an empty object
      const emptyArgs =(
        Object.keys(item.properties[m]).length === 1 &&
        item.properties[m].type === "object"
      ) 

      this.methods.push({
        method:      m,
        description: item.description,
        string:      false,
        emptyArgs,
      })

    }

  }

  /** Run schema validation on passed arguments */
  validate(
    action: { method: string },
    args:   Record<string, unknown>
  ) {

    const validate = this.ajv.compile(this.schema);

    const message = {
      [action.method]: args || {}
    };

    if (!validate(message)) {

      const msg = {
        title: this.schema.title,
        label: this.contract.label,
        calledAction: { ...action, message },
        validationErrors: validate.errors,
      }

      throw new Error(`Arguments validation returned error:\n${JSON.stringify(msg, null, 2)}`)
    }

  }

  /** Try to find method in the parsed stack and run it */
  run(
    method: string,
    args:   Agent|Record<string, unknown>,
    agent:  Agent|Record<string, unknown>,
    memo:   string,
    send:   Array<unknown>,
    fee:    unknown
  ) {
    for (const action of this.methods) {

      if (action.method === method) {

        if (isAgent(args) && !isAgent(agent)) {
          agent = args;
          args = {};
        }

        const tail: [
          Agent, string, Array<unknown>, unknown
        ] = [
          agent as Agent, memo, send, fee
        ]

        if (action.string) {
          return this.callString(action, ...tail)
        } else {
          return this.callObject(action, args as Record<string, unknown>, ...tail)
        }

      }

    }

    // This is unreachable
    throw new Error(`Method '${method}' couldn't be found in schema definition`);
  }

  /** Make a call to a simple function on a contract */
  private callString(
    action: Schema,
    agent:  Agent,
    memo:   string,
    send:   Array<unknown>,
    fee:    unknown
  ) {
    return this.getContract(agent)[this.caller](
      action.method, null, memo, send, fee
    );
  }

  /** Make a call to a method that receives arguments */
  private callObject(
    action: Schema,
    args:   Record<string, unknown>,
    agent:  Agent,
    memo:   string,
    send:   Array<unknown>,
    fee:    unknown
  ) {
    if (action.emptyArgs) {
      args = {};
    } else {
      this.validate(action, args);
    }
    return this.getContract(agent)[this.caller](
      action.method, args, memo, send, fee
    );
  }

}

/** Creates Ajv instance for schema validation*/
export function getAjv (): Ajv {
  const ajv = new Ajv({ strict: false } as unknown);
  addNumberType("int8",  127, -128);
  addNumberType("int16", 32767, -32768);
  addNumberType("int32", 2147483647, -2147483648);
  addNumberType("int64", BigInt("9223372036854775807"), BigInt("-9223372036854775808"));
  return ajv;

  // Add type validation for intN and add automatically uintN
  function addNumberType (name: string, max: number|bigint, min: number|bigint) {

    ajv.addFormat(name, {
      type:     "number",
      validate: (x: number) => (!isNaN(x) && x >= min && x <= max)
    })

    ajv.addFormat(`u${name}`, {
      type:     "number",
      validate: (x: number) => (!isNaN(x) && x >= 0 && x <= max)
    })

  }
}

export function schemaToTypes (...schemas: Array<string>) {
  return Promise.all(schemas.map(schema=>
    compileFromFile(schema).then((ts: unknown)=>{
      const output = `${dirname(schema)}/${basename(schema, '.json')}.d.ts`
      writeFileSync(output, ts)
      console.info(`Generated ${output}`)
    })))
}
