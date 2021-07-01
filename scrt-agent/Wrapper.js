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
 * Convert snake case to camel case
 *
 * @param {string} str
 * @returns {string}
 */
const camelCaseString = (str) => {
  return str.replace(/(\_\w)/g, function (m) {
    return m[1].toUpperCase();
  });
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
 * Wrapper factory that will create all the methods
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

    this.contract = contract;
    this.schema = JSON.parse(
      JSON.stringify({
        ...schema,
        type: "object",
        $schema: undefined,
      })
    );
    this.methods = [];
    this.ajv = getAjv();

    if (this.schema.title.toLowerCase().startsWith("query")) {
      this.caller = "query";
    } else if (this.schema.title.toLowerCase().startsWith("handle")) {
      this.caller = "execute";
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
   * Create the object with generated methods
   * @returns {object}
   */
  create() {
    this.parse();

    return this.methods.reduce((handlers, action) => {
      handlers[camelCaseString(action.method)] = handlers[action.method] =
        function (args, agent) {
          return this.run(action.method, args, agent);
        }.bind(this);

      return handlers;
    }, {});
  }

  /**
   * Parse the schema and generate method definitions
   * @returns {void}
   */
  parse() {
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
   * Parse schema items that only have a method call without arguments
   * @param {object} item
   */
  onlyMethod(item) {
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

  /**
   * Parse schema item that has arguments
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
        this.methods.push({
          method: m,
          description: item.description,
          string: false,
          emptyArgs: true,
        });
      } else {
        this.methods.push({
          method: m,
          description: item.description,
          string: false,
          emptyArgs: false,
        });
      }
    }
  }

  /**
   * Run schema validation on passed arguments
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

  /**
   * Try to find method in the parsed stack and run it
   * @param {string} method
   * @param {object} [args]
   * @param {SecretNetworkAgent} [agent]
   * @returns {Promise<any>}
   * @private
   */
  run(method, args, agent) {
    for (const action of this.methods) {
      if (action.method === method) {
        if (isAgent(args) && !isAgent(agent)) {
          agent = args;
          args = {};
        }

        if (action.string) {
          return this._callString(action, agent);
        } else {
          return this._callObject(action, args, agent);
        }
      }
    }

    // This is unreacheable
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
    const contract = this.getContract(agent);

    return contract[this.caller](action.method, null);
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
      this.validate(action, args);
    }

    const contract = this.getContract(agent);

    return contract[this.caller](action.method, args);
  }
}

/**
 * Wrap the class in proxy in order to work dynamically.
 *
 * @param schema
 * @param instance
 * @returns {object}
 */
export default (schema, instance) => {
  return new Factory(schema, instance).create();
};
