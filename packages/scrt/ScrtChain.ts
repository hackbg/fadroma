import { Chain } from '@fadroma/ops'

import { SigningCosmWasmClient } from 'secretjs'

export type ScrtNonce = { accountNumber: number, sequence: number }

export abstract class Scrt extends Chain {

  faucet = `https://faucet.secrettestnet.io/`

  async getNonce (address: string): Promise<ScrtNonce> {
    const sign = () => {throw new Error('unreachable')}
    const client = new SigningCosmWasmClient(this.url, address, sign)
    const { accountNumber, sequence } = await client.getNonce()
    return { accountNumber, sequence }
  }

}
