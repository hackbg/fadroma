import {
  IAgent,
  ScrtContract,
  ScrtContract_1_0,
  ScrtContract_1_2,
  loadSchemas,
  randomHex
} from "@fadroma/scrt";

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

  /** Return the address and code hash of this token in the format
   * required by the Factory to create a swap pair with this token */
  get asCustomToken () {
    return {
      custom_token: {
        contract_addr:   this.address,
        token_code_hash: this.codeHash
      }
    }
  }

  tx (agent: IAgent = this.instantiator): SNIP20ContractExecutor {
    return new SNIP20ContractExecutor(this, agent)
  }

  q (agent: IAgent = this.instantiator): SNIP20ContractQuerier {
    return new SNIP20ContractQuerier(this, agent)
  }

}

export class SNIP20ContractExecutor {

  constructor (
    readonly contract: SNIP20Contract,
    readonly agent:    IAgent
  ) {}

  /** Change admin of the token */
  changeAdmin (address: string) {
    const msg = { change_admin: { address } }
    return this.agent.execute(this.contract, msg)
  }

  /** Set specific addresses to be minters, remove all others */
  setMinters (minters: Array<string>) {
    const msg = { set_minters: { minters } }
    return this.agent.execute(this.contract, msg)
  }

  /** Add addresses to be minters */
  addMinters (minters: Array<string>) {
    const msg = { add_minters: { minters, padding: null } }
    return this.agent.execute(this.contract, msg)
  }

  /** Mint tokens */
  mint (
    amount:    string | number | bigint,
    recipient: string = this.agent.address
  ) {
    const msg = { amount: String(amount), recipient, padding: null }
    return this.agent.execute(this.contract, msg).then((tx) => {
      console.debug('WTF is going on here - TX data returned as hex string instead of buffer - why do we need the tx data anyway:', tx)
      return { tx/*, mint: JSON.parse(decode(tx.data)).mint*/ }
    })
  }

  /** Create viewing key for the agent */
  createViewingKey (entropy = randomHex(32)) {
    const msg = { create_viewing_key: { entropy, padding: null } }
    return this.agent.execute(this.contract, msg).then((tx) => ({
      tx,
      key: JSON.parse(decode(tx.data)).create_viewing_key.key,
    }))
  }

  /** Set viewing key for the agent  */
  setViewingKey (key: string) {
    const msg = { set_viewing_key: { key } }
    return this.agent.execute(this.contract, msg).then((tx) => ({
      tx,
      status: JSON.parse(decode(tx.data)).set_viewing_key.key,
    }))
  }

  /** Increase allowance to spender */
  increaseAllowance (
    amount:  string | number | bigint,
    spender: string,
  ) {
    const msg = { increase_allowance: { amount: String(amount), spender } }
    return this.agent.execute(this.contract, msg)
  }

  /** Decrease allowance to spender */
  decreaseAllowance (
    amount:  string | number | bigint,
    spender: string,
  ) {
    const msg = { decrease_allowance: { amount: String(amount), spender } }
    return this.agent.execute(this.contract, msg)
  }

}

export class SNIP20ContractQuerier {

  constructor (
    readonly contract: SNIP20Contract,
    readonly agent:    IAgent
  ) {}

  /** Get address balance */
  async balance (address: string, key: string) {
    const msg = { balance: { address, key } }
    const response = await this.agent.query(this.contract, msg)
    if (response.balance && response.balance.amount) {
      return response.balance.amount
    } else {
      throw new Error(JSON.stringify(response))
    }
  }

  /** Check available allowance */
  checkAllowance (spender: string, owner: string, key: string) {
    const msg = { owner, spender, key }
    return this.agent.query(this.contract, msg)
  }

}

// Set build config:

const scrtContract_1_0 = new ScrtContract_1_0()
export class SNIP20Contract_1_0 extends SNIP20Contract {
  // @ts-ignore
  buildImage      = scrtContract_1_0.buildImage

  buildDockerfile = scrtContract_1_0.buildDockerfile

  // @ts-ignore
  buildScript     = scrtContract_1_0.buildScript
}

const scrtContract_1_2 = new ScrtContract_1_2()
export class SNIP20Contract_1_2 extends SNIP20Contract {
  // @ts-ignore
  buildImage      = scrtContract_1_2.buildImage

  buildDockerfile = scrtContract_1_2.buildDockerfile

  // @ts-ignore
  buildScript     = scrtContract_1_2.buildScript
}
