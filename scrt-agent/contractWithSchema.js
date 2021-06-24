import Wrapper from './Wrapper.js';
import SecretNetworkContract from './contract.js';

export default class SecretNetworkContractWithSchema extends SecretNetworkContract {
  constructor(options = {}, schema) {
    super(options);
    this.q = Wrapper(schema.queryMsg, this);
    this.tx = Wrapper(schema.handleMsg, this);
  }
}
