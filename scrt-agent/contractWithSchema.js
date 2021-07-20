import Wrapper, { getAjv } from "./Wrapper.js";
import SecretNetworkContract from "./contract.js";

export default class SecretNetworkContractWithSchema extends SecretNetworkContract {
  constructor(options = {}, schema) {
    if (schema && schema.initMsg) {
      const ajv = getAjv();
      const validate = ajv.compile(schema.initMsg);
      if (!validate(options.initMsg)) {
        throw new Error(
          `Schema validation for initMsg returned an error: \n${JSON.stringify(
            validate.errors,
            null,
            2
          )}`
        );
      }
    }

    super(options);
    this.q = Wrapper(schema.queryMsg, this);
    this.tx = Wrapper(schema.handleMsg, this);
  }
}
