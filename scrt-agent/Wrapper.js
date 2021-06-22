import Ajv from "ajv";

/**
 * Check if the passed instance has required methods
 * to behave like an agent
 *
 * @param {*} maybeAgent
 * @returns
 */
const isAgent = (maybeAgent) => {
  return (
    maybeAgent &&
    typeof maybeAgent === "object" &&
    typeof maybeAgent.query === "function" &&
    typeof maybeAgent.execute === "function"
  );
};

/**
 * Convert camel case string into a snake case
 *
 * @param {string} str
 * @returns
 */
const snakeCaseString = (str) => {
  return (
    str &&
    str
      .match(
        /[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g
      )
      .map((s) => s.toLowerCase())
      .join("_")
  );
};

/**
 * Creates Ajv instance for schema validation 
 * 
 * @returns {Ajv}
 */
const getAjv = () => {
  const ajv = new Ajv({ strict: false });

  // Add type validation for intN and add automatically uintN
  const n = (name, max, min) => {
    ajv.addFormat(name, {
      type: "number",
      validate: (x) => !isNaN(x) && x >= min && x <= max,
    });
    ajv.addFormat(`u${name}`, {
      type: "number",
      validate: (x) => !isNaN(x) && x >= 0 && x <= max,
    });
  };

  n("int8", 127, -128);
  n("int16", 32767, -32768);
  n("int32", 2147483647, -2147483648);
  n("int64", 9223372036854775807n, -9223372036854775808n);

  return ajv;
};
/**
 * Wrapper factory that hold all the definitions
 * for methods and will run validation
 *
 * @class
 */
class Factory {
  /**
   * @param {object} schema 
   * @param {SecretNetworkContract} contract 
   */
  constructor(schema, contract) {
    if (typeof schema !== "object" || schema === null) {
      throw new Error("Schema must be an object");
    }

    if (
      !schema.title.toLowerCase().startsWith("query") &&
      !schema.title.toLowerCase().startsWith("handle")
    ) {
      throw new Error(
        `Unsupported schema, at the time, only supported are some variants that have title starting with 'Query' or 'Handle'`
      );
    }

    this.contract = contract;
    this.schema = JSON.parse(
      JSON.stringify({
        ...schema,
        type: "object",
        $schema: undefined,
      })
    );
    this.string = [];
    this.object = [];

    this.ajv = getAjv();
  }

  /**
   * Figure out what kind of a call we are making based on schema
   *
   * @returns {string}
   */
  caller() {
    if (this.schema.title.toLowerCase().startsWith("query")) {
      return "query";
    } else if (this.schema.title.toLowerCase().startsWith("handle")) {
      return "execute";
    }
  }

  /**
   * Make a call on an agent and allow it to be overriden with custom
   *
   * @param {SecretNetworkAgent} [agent]
   * @returns {SecretNetworkContract}
   */
  getContract(agent) {
    if (isAgent(agent) && typeof this.contract.copy === "function") {
      return this.contract.copy(agent);
    }

    return this.contract;
  }

  /**
   * Generates the definitions and loads the wrapper with them
   * @returns {Wrapper}
   */
  create() {
    this.generate();

    return new Wrapper(this);
  }

  /**
   * Runs the generation of definitions that will be used by the wrapper
   * @returns {void}
   */
  generate() {
    if (Array.isArray(this.schema.anyOf)) {

      for (const item of this.schema.anyOf) {
        if (item.type === "string") {
          this.onlyMethod(item);
        } else if (item.type === "object") {
          this.methodWithArgs(item);
        }
      }
    }

    if (this.schema.type === "string" && Array.isArray(this.schema.enum)) {
      this.onlyMethod(this.schema);
    }
  }

  /**
   * Handles the validation of items that only have a method name
   *
   * @param {object} item
   */
  onlyMethod(item) {
    if (Array.isArray(item.enum)) {
      for (const m of item.enum) {
        this.string.push({
          method: m,
          description: item.description,
        });
      }
    }
  }

  /**
   * Handles the items that have method and also receive some arguments
   *
   * @param {object} item
   */
  methodWithArgs(item) {
    if (Array.isArray(item.required)) {
      const m = item.required[0];

      // This is to handle those enum variants that have arguments but it's only an empty object
      if (
        Object.keys(item.properties[m]).length === 1 &&
        item.properties[m].type === "object"
      ) {
        this.object.push({
          method: m,
          description: item.description,
          emptyArgs: true,
        });
      } else {
        this.object.push({
          method: m,
          description: item.description,
          emptyArgs: false,
        });
      }
    }
  }

  /**
   * Run validation on arguments sent based on the provided schema
   *
   * @param {object} action
   * @param {object} [args]
   */
  validate(action, args) {
    const validate = this.ajv.compile(this.schema);
    const message = { [action.method]: args || {} };

    if (!validate(message)) {
      throw new Error(
        `Arguments validation returned error:\n${JSON.stringify(
          {
            title: this.schema.title,
            label: this.contract.label,
            calledAction: { ...action, message },
            validationErrors: validate.errors,
          },
          null,
          2
        )}`
      );
    }
  }
}

class Wrapper {
  /**
   * Construct the instance wrapper.
   *
   * @param factory
   */
  constructor(factory) {
    this.factory = factory;
  }

  /**
   * Dynamically parse schema and convert it into methods on an instance
   *
   * @param {string} method
   * @param {object} [args]
   * @param {SecretNetworkAgent} [agent]
   * @returns {Promise<any>}
   * @private
   */
  _run(method, args, agent) {
    method = snakeCaseString(method);

    for (const action of this.factory.string) {
      if (action.method === method) {
        if (isAgent(args) && !isAgent(agent)) {
          agent = args;
        }

        return this._callString(action, agent);
      }
    }

    for (const action of this.factory.object) {
      if (action.method === method) {
        return this._callObject(action, args, agent);
      }
    }

    throw new Error(
      `Method '${method}' couldn't be found in schema definition`
    );
  }

  /**
   * Make a call to a simple function on a contract
   * @param {object} action
   * @param {SecretNetworkAgent} [agent]
   */
  _callString(action, agent) {
    const contract = this.factory.getContract(agent);

    return contract[this.factory.caller()](action.method, null);
  }

  /**
   * Make a call to a method that receives arguments
   * @param {object} action
   * @param {object} args
   * @param {SecretNetworkAgent} [agent]
   */
  _callObject(action, args, agent) {
    if (action.emptyArgs) {
      args = {};
    } else {
      this.factory.validate(action, args);
    }

    const contract = this.factory.getContract(agent);

    return contract[this.factory.caller()](action.method, args);
  }
}

/**
 * Wrap the class in proxy in order to work dynamically.
 *
 * @param schema
 * @param instance
 * @returns {Wrapper}
 */
const proxy = (schema, instance) =>
  new Proxy(new Factory(schema, instance).create(), {
    get(target, name) {
      return function wrapper() {
        const [args, agent] = Object.keys(arguments).map((k) => arguments[k]);

        return target._run(name, args, agent);
      };
    },
  });

export default proxy;
