declare module '@fadroma/client-scrt' {

  import type { Address, Fee } from '@fadroma/client'

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

  export interface Signer {
    chain_id: string
    signer:  Address
    sign <T> (permit_msg: PermitAminoMsg<T>): Promise<Permit<T>>
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
    readonly fee:            Fee;
    /** Always 1 message of type query_permit */
    readonly msgs:           readonly AminoMsg[];
    /** Always empty. */
    readonly memo:           string;
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

  /** Helper function to create a {@link SignDoc}.
    * All other fields on that type must be constant. */
  export function createSignDoc <T> (chain_id: string, permit_msg: PermitAminoMsg<T>): SignDoc

  export class KeplrSigner implements Signer {

    constructor(
      /** The id of the chain which permits will be signed for. */
      readonly chain_id: string,
      /** The address which will do the signing and
        * which will be the address used by the contracts. */
      readonly signer: Address,
      /** Must be a pre-configured instance. */
      readonly keplr: any
    )

    sign <T> (
      /** Query specific parameters that will be created by the consuming contract. */
      permit_msg: PermitAminoMsg<T>
    ): Promise<Permit<T>>

  }

}
