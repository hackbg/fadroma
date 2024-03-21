import type { Token, ChainId, Address } from '@fadroma/agent'

/** Data used for creating a signature as per the SNIP-24 spec:
  * https://github.com/SecretFoundation/SNIPs/blob/master/SNIP-24.md#permit-content---stdsigndoc
  * This type is case sensitive! */
export interface SignDoc {
  readonly chain_id: string;
  /** Always 0. */
  readonly account_number: string;
  /** Always 0. */
  readonly sequence: string;
  /** Always 0 uscrt + 1 gas */
  readonly fee: Token.IFee;
  /** Always 1 message of type query_permit */
  readonly msgs: readonly AminoMsg[];
  /** Always empty. */
  readonly memo: string;
}

export interface Permit <T> {
  params: {
    permit_name: string,
    allowed_tokens: Address[]
    chain_id: string,
    permissions: T[]
  },
  signature: Signature
}

// This type is case sensitive!
export interface Signature { readonly pub_key: Pubkey, readonly signature: string }

export interface Pubkey { readonly type: 'tendermint/PubKeySecp256k1', readonly value: any }

export interface AminoMsg { readonly type: string, readonly value: any }

/** Used as the `value` field of the {@link AminoMsg} type. */
export interface PermitAminoMsg<T> {
  permit_name:    string,
  allowed_tokens: Address[],
  permissions:    T[],
}

export abstract class PermitSigner  {
  static createSignDoc = <T> (chain_id: ChainId, permit_msg: T): SignDoc => ({
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
  })

  constructor (
    /** The id of the chain for which permits will be signed. */
    readonly chainId: ChainId,
    /** The address which will do the signing and
      * which will be the address used by the contracts. */
    readonly address: Address,
  ) {}

  abstract sign <T> (permit_msg: PermitAminoMsg<T>): Promise<Permit<T>>
}

export class PermitSignerKeplr extends PermitSigner {

  constructor (
    chainId: ChainId,
    address: Address,
    /** Must be a pre-configured instance. */
    readonly keplr: KeplrSigningHandle<any>
  ) {
    super(chainId, address)
  }

  async sign <T> (permit_msg: PermitAminoMsg<T>): Promise<Permit<T>> {
    const preferNoSetFee  = true // Fee must be 0, so hide it from the user
    const preferNoSetMemo = true // Memo must be empty, so hide it from the user
    const { signature } = await this.keplr.signAmino( // Call Keplr signing UI
      this.chainId,
      this.address,
      PermitSignerKeplr.createSignDoc(this.chainId, permit_msg),
      { preferNoSetFee, preferNoSetMemo, }
    )
    return {
      params: {
        chain_id:       this.chainId,
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
