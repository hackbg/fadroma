import Wrapper from "./Wrapper.js";
import SecretNetworkContract from "./contract.js";
export default class SecretNetworkContractWithSchema extends SecretNetworkContract {
  constructor(options = {}, schema) {
    super(options);
    this.wrapperForQuery = Wrapper(schema.queryMsg, this);
    this.wrapperForExecute = Wrapper(schema.handleMsg, this);
  }

  /* Returns a function binding the executing agent
   * to a collection of possible queries */
  q() {
    return this.wrapperForQuery;
  }

  /* Returns a function binding the executing agent
   * to a collection of possible transactions */
  tx() {
    return this.wrapperForExecute;
  }
}
