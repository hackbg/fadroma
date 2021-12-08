import type { IAgent, ContractAPIOptions } from "@fadroma/scrt";
import { ScrtContract, loadSchemas } from "@fadroma/scrt";
import { randomHex } from "@fadroma/tools";
import { abs } from "../ops/index";

// @ts-ignore
const decoder = new TextDecoder();
const decode = (buffer: any) => decoder.decode(buffer).trim();

export class SNIP20Contract extends ScrtContract {

  static schema = loadSchemas(import.meta.url, {
    initMsg:      "./schema/init_msg.json",
    queryMsg:     "./schema/query_msg.json",
    queryAnswer:  "./schema/query_answer.json",
    handleMsg:    "./schema/handle_msg.json",
    handleAnswer: "./schema/handle_answer.json",
  });

  constructor(options: ContractAPIOptions = {}) {
    super({ ...options, schema: SNIP20Contract.schema });
  }

  /**
   * Change admin of the token
   *
   * @param {string} address
   * @param {IAgent} [agent]
   * @returns
   */
  changeAdmin = (address: string, agent?: IAgent) =>
    this.tx.change_admin({ address }, agent);

  /**
   * Add addresses to be minters
   *
   * @param {string[]} minters
   * @param {IAgent} [agent]
   * @returns
   */
  setMinters = (minters: Array<string>, agent?: IAgent) =>
    this.tx.set_minters({ minters }, agent);

  /**
   * Set specific addresses to be minters, remove all others
   *
   * @param {string[]} minters
   * @param {IAgent} [agent]
   * @returns
   */
  addMinters = (minters: Array<string>, agent?: IAgent) =>
    this.tx.add_minters({ minters, padding: null }, agent);

  /**
   * Mint tokens
   * @param {string|number|bigint} amount
   * @param agent
   * @param recipient
   * @returns
   */
  mint = (
    amount: string | number | bigint,
    agent = this.instantiator,
    recipient = agent.address
  ) =>
    this.tx
      .mint({ amount: String(amount), recipient, padding: null }, agent)
      .then((tx) => {
        console.debug('WTF is going on here - TX data returned as hex string instead of buffer - why do we need the tx data anyway:', tx)
        return { tx/*, mint: JSON.parse(decode(tx.data)).mint*/ }
      });

  /**
   * Get address balance
   *
   * @param {string} address
   * @param {string} key
   * @returns
   */
  balance = async (address: string, key: string) => {
    const response = await this.q.balance({ address, key });

    if (response.balance && response.balance.amount) {
      return response.balance.amount;
    } else {
      throw new Error(JSON.stringify(response));
    }
  };

  /**
   * Create viewing key for the agent
   *
   * @param {IAgent} agent
   * @param {string} entropy
   * @returns
   */
  createViewingKey = (agent: IAgent, entropy = randomHex(32)) =>
    this.tx
      .create_viewing_key({ entropy, padding: null }, agent)
      .then((tx) => ({
        tx,
        key: JSON.parse(decode(tx.data)).create_viewing_key.key,
      }));

  /**
   * Set viewing key for the agent
   *
   * @param {IAgent} agent
   * @param {string} key
   * @returns
   */
  setViewingKey = (agent: IAgent, key: string) =>
    this.tx.set_viewing_key({ key }, agent).then((tx) => ({
      tx,
      status: JSON.parse(decode(tx.data)).set_viewing_key.key,
    }));

  /**
   * Increase allowance to spender
   * @param {string|number|bigint} amount
   * @param {string} spender
   * @param {IAgent} [agent]
   * @returns
   */
  increaseAllowance = (
    amount: string | number | bigint,
    spender: string,
    agent?: IAgent
  ) => this.tx.increase_allowance({ amount: String(amount), spender }, agent);

  /**
   * Decrease allowance to spender
   * @param {string|number|bigint} amount
   * @param {string} spender
   * @param {IAgent} [agent]
   * @returns
   */
  decreaseAllowance = (
    amount: string | number | bigint,
    spender: string,
    agent?: IAgent
  ) => this.tx.decrease_allowance({ amount: String(amount), spender }, agent);

  /**
   * Check available allowance
   *
   * @param {string} spender
   * @param {string} owner
   * @param {string} key
   * @param {IAgent} [agent]
   * @returns
   */
  checkAllowance = (
    spender: string,
    owner: string,
    key: string,
    agent?: IAgent
  ) => this.q.allowance({ owner, spender, key }, agent);

  /**
   * Perform send with a callback message that will be sent to IDO contract
   *
   * @param {string} contractAddress Address of the IDO contract where we will send this amount
   * @param {string|number|bigint} amount Amount to send
   * @param {string} [recipient] Recipient of the bought funds from IDO contract
   * @param {IAgent} [agent]
   * @returns
   */
  sendIdo = (
    contractAddress: string,
    amount: string | number | bigint,
    recipient: string | null = null,
    agent?: IAgent
  ) =>
    this.tx.send(
      {
        recipient: contractAddress,
        amount: `${amount}`,
        msg: Buffer.from(
          JSON.stringify({ swap: { recipient } }),
          "utf8"
        ).toString("base64"),
      },
      agent
    );

  /**
   * Perform locking of the funds in launchpad contract
   *
   * @param {string} contractAddress Address of the Launchpad contract where we will send this amount
   * @param {string|number|bigint} amount Amount to send
   * @param {IAgent} [agent]
   * @returns
   */
  lockLaunchpad = (
    contractAddress: string,
    amount: string | number | bigint,
    agent?: IAgent
  ) =>
    this.tx.send(
      {
        recipient: contractAddress,
        amount: `${amount}`,
        msg: Buffer.from(JSON.stringify({ lock: {} }), "utf8").toString(
          "base64"
        ),
      },
      agent
    );

  /**
   * Perform locking of the funds in launchpad contract
   *
   * @param {string} contractAddress Address of the Launchpad contract
   * @param {number} entries Number of entries to unlock
   * @param {IAgent} [agent]
   * @returns
   */
  unlockLaunchpad = (contractAddress: string, entries: number, agent?: IAgent) => {
    const message = {
      recipient: contractAddress,
      amount: `0`,
      msg: Buffer.from(
        JSON.stringify({ unlock: { entries } }),
        "utf8"
      ).toString("base64"),
    };
    return this.tx.send(
      message,
      agent
    );
  }

  /**
   * Return the address and code hash of this token in the format
   * required by the Factory to create a swap pair with this token
   */
  get asCustomToken () {
    return {
      custom_token: {
        contract_addr:   this.address,
        token_code_hash: this.codeHash
      }
    }
  }
}
