import {
  Address,
  Agent,
  Bundle,
  Chain,
  ChainId,
  Client,
  Fee,
  IFee,
  Message,
  Template,
  Uint128
} from '@fadroma/client'

import { randomBytes } from 'crypto'

export abstract class ScrtChain extends Chain {
  isSecretNetwork = true
  defaultDenom    = ScrtGas.denom
}

export abstract class ScrtAgent extends Agent {

  fees = ScrtGas.defaultFees

  async instantiateMany (configs: [Template, string, Message][] = []) {
    // instantiate multiple contracts in a bundle:
    const instances = await this.bundle().wrap(async bundle=>{
      await bundle.instantiateMany(configs)
    })
    // add code hashes to them:
    for (const i in configs) {
      const [{ codeId, codeHash }, label] = configs[i]
      const instance = instances[i]
      if (instance) {
        instance.codeId   = codeId
        instance.codeHash = codeHash
        instance.label    = label
      }
    }
    return instances
  }

}

export abstract class ScrtBundle extends Bundle {}

export interface ScrtBundleResult {
  tx:        string
  type:      string
  chainId:   string
  codeId?:   string
  codeHash?: string
  address?:  string
  label?:    string
}

export interface ScrtBundleCtor <B extends ScrtBundle> {
  new (agent: ScrtAgent): B
}

export class ScrtGas extends Fee {

  static denom = 'uscrt'

  static defaultFees = {
    upload: new ScrtGas(4000000),
    init:   new ScrtGas(1000000),
    exec:   new ScrtGas(1000000),
    send:   new ScrtGas( 500000),
  }

  constructor (amount: Uint128|number) {
    super(amount, ScrtGas.denom)
  }

}

/** Data used for creating a signature as per the SNIP-24 spec:
  * https://github.com/SecretFoundation/SNIPs/blob/master/SNIP-24.md#permit-content---stdsigndoc
  * This type is case sensitive! */
export interface SignDoc {
  readonly chain_id:       string;
  /** Always 0. */
  readonly account_number: string;
  /** Always 0. */
  readonly sequence:       string;
  /** Always 0 uscrt + 1 gas */
  readonly fee:            IFee;
  /** Always 1 message of type query_permit */
  readonly msgs:           readonly AminoMsg[];
  /** Always empty. */
  readonly memo:           string;
}

export function createSignDoc <T> (
  chain_id:   ChainId,
  permit_msg: T
) {
  return {
    chain_id,
    account_number: "0", // Must be 0
    sequence: "0", // Must be 0
    fee: {
      amount: [{ denom: "uscrt", amount: "0" }], // Must be 0 uscrt
      gas: "1", // Must be 1
    },
    msgs: [
      {
        type: "query_permit", // Must be "query_permit"
        value: permit_msg,
      },
    ],
    memo: "", // Must be empty
  }
}

export interface Signer {
  chain_id: ChainId
  address:  Address
  sign <T> (permit_msg: PermitAminoMsg<T>): Promise<Permit<T>>
}

export class KeplrSigner implements Signer {

  constructor (
    /** The id of the chain which permits will be signed for. */
    readonly chain_id: ChainId,
    /** The address which will do the signing and
      * which will be the address used by the contracts. */
    readonly address:  Address,
    /** Must be a pre-configured instance. */
    readonly keplr:    KeplrSigningHandle<any>
  ) {}

  async sign <T> (permit_msg: PermitAminoMsg<T>): Promise<Permit<T>> {

    const { signature } = await this.keplr.signAmino(
      this.chain_id,
      this.address,
      createSignDoc(this.chain_id, permit_msg),
      {
        preferNoSetFee: true,  // Fee must be 0, so hide it from the user
        preferNoSetMemo: true, // Memo must be empty, so hide it from the user
      }
    )

    return {
      params: {
        chain_id:       this.chain_id,
        allowed_tokens: permit_msg.allowed_tokens,
        permit_name:    permit_msg.permit_name,
        permissions:    permit_msg.permissions
      },
      signature
    }

  }

}

export interface KeplrSigningHandle <T> {
  signAmino (
    chain_id: ChainId,
    address:  Address,
    signDoc:  SignDoc,
    options: { preferNoSetFee: boolean, preferNoSetMemo: boolean }
  ): Promise<Permit<T>>
}

export interface Permit<T> {
  params: {
    permit_name:    string,
    allowed_tokens: Address[]
    chain_id:       string,
    permissions:    T[]
  },
  signature: Signature
}

// This type is case sensitive!
export interface Signature {
  readonly pub_key: Pubkey
  readonly signature: string
}

export interface Pubkey {
  /** Must be: `tendermint/PubKeySecp256k1` */
  readonly type: string
  readonly value: any
}

export interface AminoMsg {
  readonly type: string;
  readonly value: any;
}

/** Used as the `value` field of the {@link AminoMsg} type. */
export interface PermitAminoMsg<T> {
  permit_name:    string,
  allowed_tokens: Address[],
  permissions:    T[],
}

export type ViewingKey = string

export class ViewingKeyClient extends Client {

  async create (entropy = randomBytes(32).toString("hex")) {
    const msg    = { create_viewing_key: { entropy, padding: null } }
    let { data } = await this.execute(msg) as { data: Uint8Array|Uint8Array[] }
    if (data instanceof Uint8Array) data = [data]
    return data[0]
  }

  async set (key: unknown) {
    return this.execute({ set_viewing_key: { key } })
  }

}

export * from '@fadroma/client'
