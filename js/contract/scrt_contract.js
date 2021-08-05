import { writeFile, resolve } from "@fadroma/utilities";

/** Interface to a contract instance.
  * Can be subclassed with schema to auto-generate methods
  * TODO connect to existing contract */
export default class SecretNetworkContract {
  /** Create an object representing a remote smart contract instance.
   */
  constructor(options = {}) {
    const { agent, label, codeId, codeHash, initMsg, initTx } = options;
    Object.assign(this, { agent, label, codeId, codeHash, initMsg, initTx });
  }

  /**Get the address of the contract.
   */
  get address() {
    return this.initTx.contractAddress;
  }

  /**Get a reference to the contract (address + code_hash)
   * in a format matching `scrt-callback`'s `ContractInstance`
   */
  get reference() {
    return {
      address: this.address,
      code_hash: this.codeHash,
    };
  }

  /**Query the contract.
   */
  query = (method = "", args = null, agent = this.agent) =>
    agent.query(this, method, args);

  /**Execute a contract transaction.
   */
  execute = (method = "", args = null, agent = this.agent, memo, transferAmount, fee) =>
    agent.execute(this, method, args, memo, transferAmount, fee);

  /** Save the contract's instantiation receipt.
   */
  save = () =>
    writeFile(this.receiptPath, JSON.stringify(this.receipt, null, 2), "utf8");

  /**
   * Create a temporary copy of a contract with a different agent
   *
   * @param {SecretNetworkAgent} [agent]
   * @returns
   */
  copy = (agent) => {
    if (
      agent &&
      typeof agent.query === "function" &&
      typeof agent.execute === "function"
    ) {
      return new SecretNetworkContract({ ...this, agent });
    }

    return new SecretNetworkContract(this);
  };

  /** Get the path to the contract receipt for the contract's code.
   */
  get receiptPath() {
    return resolve(this.network.instances, `${this.label}.json`);
  }

  /** Get the contents of the contract receipt.
   */
  get receipt() {
    return {
      label: this.label,
      codeId: this.codeId,
      codeHash: this.codeHash,
      initTx: this.initTx,
    };
  }

  /**Get an interface to the network where the contract is deployed.
   */
  get network() {
    return this.agent.network;
  }
}
