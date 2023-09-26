import { Config } from '@hackbg/conf'
import {
  bindChainSupport, Chain, Agent, Bundle, Console, Error, bold, bip32, bip39, bip39EN, bech32
} from '@fadroma/agent'
import { CosmWasmClient, SigningCosmWasmClient } from '@hackbg/cosmjs-esm'
import { ripemd160 } from "@noble/hashes/ripemd160"
import { sha256 } from "@noble/hashes/sha256"
import { secp256k1 } from "@noble/curves/secp256k1";

class CWConfig extends Config {}

class CWError extends Error {}

class CWConsole extends Console {}

/** Generic CosmWasm-enabled chain. */
class CWChain extends Chain {
  defaultDenom = ''
  /** Query-only API handle. */
  api?: CosmWasmClient

  /** Async initialization. Populates the `api` property. */
  get ready (): Promise<this & { api: CosmWasmClient }> {
    if (this.api) return Promise.resolve(this) as Promise<this & {
      api: CosmWasmClient
    }>
    return CosmWasmClient
      .connect(this.url)
      .then(api=>Object.assign(this, { api }))
  }
}

/** Generic agent for CosmWasm-enabled chains. */
class CWAgent extends Agent {
  /** Signing API handle. */
  declare api?: SigningCosmWasmClient
  /** The coin type in the HD derivation path */
  coinType?: number
  /** The bech32 prefix for the account's address  */
  bech32Prefix?: string
  /** The account index in the HD derivation path */
  hdAccountIndex?: number
  /** Async initialization. Populates the `api` property. */
  get ready (): Promise<this & { api: CosmWasmClient }> {
    if (this.coinType === undefined) {
      throw new CWError('coinType is not set')
    }
    if (this.bech32Prefix === undefined) {
      throw new CWError('bech32Prefix is not set')
    }
    if (this.hdAccountIndex === undefined) {
      throw new CWError('hdAccountIndex is not set')
    }
    if (!this.chain) {
      throw new CWError('no chain specified')
    }
    if (this.api) return Promise.resolve(this) as Promise<this & {
      api: CosmWasmClient
    }>
    if (!this.mnemonic) {
      this.log.log("No mnemonic provided, generating one.")
      this.mnemonic = bip39.generateMnemonic(bip39EN)
    }
    const seed = bip39.mnemonicToSeedSync(this.mnemonic);
    const node = bip32.HDKey.fromMasterSeed(seed);
    const secretHD = node.derive(`m/44'/${this.coinType}'/0'/0/${this.hdAccountIndex}`);
    const privateKey = secretHD.privateKey;
    if (!privateKey) {
      throw new CWError("failed to derive key pair")
    }
    const pubkey = secp256k1.getPublicKey(new Uint8Array(privateKey), true);
    this.address = bech32.encode(this.bech32Prefix, bech32.toWords(ripemd160(sha256(pubkey))))
    this.name ??= this.address
    return SigningCosmWasmClient
      .connect(this.chain.url)
      .then(api=>Object.assign(this, { api }))
  }
}

/** Generic transaction bundle for CosmWasm-enabled chains. */
class CWBundle extends Bundle {}

export {
  CWConfig  as Config,
  CWError   as Error,
  CWConsole as Console,
  CWChain   as Chain,
  CWAgent   as Agent,
  CWBundle  as Bundle
}

bindChainSupport(CWChain, CWAgent, CWBundle)
