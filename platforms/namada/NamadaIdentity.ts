import { MnemonicIdentity } from '@fadroma/cw'

export const coinType       = 118
export const bech32Prefix   = 'tnam'
export const hdAccountIndex = 0

class NamadaMnemonicIdentity extends MnemonicIdentity {
  constructor (properties?: { mnemonic?: string } & Partial<MnemonicIdentity>) {
    super({ coinType, bech32Prefix, hdAccountIndex, ...properties||{} })
  }
}

export {
  NamadaMnemonicIdentity as Mnemonic,
}
