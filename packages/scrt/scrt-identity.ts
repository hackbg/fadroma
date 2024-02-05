import { Chain } from '@fadroma/agent'
import type { ChainId } from '@fadroma/agent'
import { SecretNetworkClient, Wallet } from '@hackbg/secretjs-esm'
import type { EncryptionUtils } from '@hackbg/secretjs-esm'
import { ScrtError as Error, bold, colors, assign, bip39, bip39EN } from './scrt-base'

export abstract class ScrtIdentity extends Chain.Identity {
  abstract getApi ({chainId, url}: {chainId: ChainId, url: string|URL}): SecretNetworkClient

  static fromKeplr = () => {
    throw new Error('unimplemented')
  }
}

export class ScrtSignerIdentity extends ScrtIdentity {
  encryptionUtils?: EncryptionUtils
  constructor ({ encryptionUtils, ...properties }: Partial<ScrtSignerIdentity>) {
    super(properties)
  }
  getApi ({chainId, url}: {chainId: ChainId, url: string|URL}): SecretNetworkClient {
    return new SecretNetworkClient({
      chainId, url: url.toString(), encryptionUtils: this.encryptionUtils
    })
  }
}

export class ScrtMnemonicIdentity extends ScrtIdentity {
  wallet: Wallet
  constructor ({
    mnemonic = bip39.generateMnemonic(bip39EN),
    wallet = new Wallet(mnemonic),
    ...properties
  }: Partial<ScrtMnemonicIdentity & {
    mnemonic: string
  }>) {
    super(properties)
    this.wallet = wallet
    if (this.address && (wallet.address !== this.address)) {
      throw new Error(`computed address ${wallet.address} did not match ${this.address}`)
    }
    this.address = wallet.address
  }
  getApi ({chainId, url}: {chainId: ChainId, url: string|URL}): SecretNetworkClient {
    const {wallet} = this
    return new SecretNetworkClient({
      chainId, url: url.toString(), wallet, walletAddress: wallet.address,
    })
  }
}
