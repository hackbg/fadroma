import assert from 'node:assert'
import * as Scrt from './scrt'
import type { ChainId, Address } from '@fadroma/agent'

export default async function testSnip24 () {

  Scrt.Snip24.PermitSigner.createSignDoc('chain-id', {
    foo: 'bar'
  })

  const permitSigner = new Scrt.Snip24.PermitSignerKeplr('chain-id', 'address', {
    signAmino: async function signAmino (
      chain_id: ChainId,
      address:  Address,
      signDoc:  Scrt.Snip24.SignDoc,
      options: { preferNoSetFee: boolean, preferNoSetMemo: boolean }
    ) {
      return {
        signature: {
          pub_key: 'pub_key' as any,
          signature: 'signature'
        },
        params: {
          permit_name: 'permit_name',
          allowed_tokens: [],
          chain_id: 'chain-id',
          permissions: []
        }
      }
    }
  })

  assert.ok(permitSigner.sign({
    permit_name: 'permit_name',
    allowed_tokens: [],
    permissions: []
  }))

}
