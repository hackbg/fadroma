export function createSignDoc (chain_id, permit_msg) {
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

export class KeplrSigner {

  constructor (chain_id, signer, keplr) {
    this.chain_id = chain_id
    this.signer = signer
    this.keplr = keplr
  }

  chain_id
  signer
  keplr

  async sign (permit_msg) {

    const { signature } = await this.keplr.signAmino(
      this.chain_id,
      this.signer,
      create_sign_doc(this.chain_id, permit_msg),
      {
        preferNoSetFee: true,  // Fee must be 0, so hide it from the user
        preferNoSetMemo: true, // Memo must be empty, so hide it from the user
      }
    )

    return {
      params: {
        chain_id: this.chain_id,
        allowed_tokens: permit_msg.allowed_tokens,
        permit_name: permit_msg.permit_name,
        permissions: permit_msg.permissions
      },
      signature
    }

  }

}
