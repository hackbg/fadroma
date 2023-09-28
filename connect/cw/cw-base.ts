import { Config } from '@hackbg/conf'
import {
  bindChainSupport, Chain, Agent, Bundle, Console, Error, bold, bip32, bip39, bip39EN, bech32,
  into, assertChain, ICoin
} from '@fadroma/agent'
import type { Address, Client, Contract, Instantiated } from '@fadroma/agent'
import { CosmWasmClient, SigningCosmWasmClient } from '@hackbg/cosmjs-esm'
import type { logs, OfflineSigner as Signer } from '@hackbg/cosmjs-esm'
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
  constructor (options: Partial<CWAgent> = {}) {
    super(options)
    this.api = options.api
    this.coinType = options.coinType
    this.bech32Prefix = options.bech32Prefix
    this.hdAccountIndex = options.hdAccountIndex
    this.signer = options.signer
  }

  /** Signing API handle. */
  declare api?: SigningCosmWasmClient
  /** The bech32 prefix for the account's address  */
  bech32Prefix?: string
  /** The coin type in the HD derivation path */
  coinType?: number
  /** The account index in the HD derivation path */
  hdAccountIndex?: number
  /** The provided signer, which signs the transactions.
    * TODO: Implement signing transactions without external signer. */
  signer?: Signer
  /** Async initialization. Populates the `api` property. */
  get ready (): Promise<this & { api: CosmWasmClient }> {
    const init = new Promise<this & { api: CosmWasmClient }>(async (resolve, reject)=>{
      // TODO: Implement own signer
      if (this.signer === undefined) {
        throw new CWError('signer is not set')
      }
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
        .connectWithSigner(this.chain.url, this.signer)
        .then(api=>Object.assign(this, { api }))
    })
    Object.defineProperty(this, 'ready', { get () { return init } })
    return init
  }

  async getBalance (denom?: string, address?: Address): Promise<string> {
    const { api } = await this.ready
    denom ??= this.defaultDenom
    address ??= this.address
    const { amount } = await api.getBalance(address!, denom)
    return amount
  }

  async instantiate <C extends Client> (
    instance: Contract<C>,
    init_funds: ICoin[] = []
  ): Promise<Instantiated> {
    const { api } = await this.ready
    if (!this.address) throw new Error("Agent has no address")
    if (instance.address) {
      this.log.warn("Instance already has address, not instantiating.")
      return instance as Instantiated
    }
    const { chainId, codeId, codeHash, label, initMsg } = instance
    const code_id = Number(instance.codeId)
    if (isNaN(code_id)) throw new Error.Missing.CodeId()
    if (!label) throw new Error.Missing.Label()
    if (!initMsg) throw new Error.Missing.InitMsg()
    if (chainId && chainId !== assertChain(this).id) throw new Error.Invalid.WrongChain()
    const parameters = {
      sender:    this.address,
      code_id,
      code_hash: codeHash!,
      init_msg:  await into(initMsg),
      label,
      init_funds
    }
    const gasLimit = Number(this.fees?.init?.amount[0].amount) || undefined
    const result = await api.instantiate(
      this.address,
      code_id,
      await into(initMsg),
      label,
      gasLimit || 'auto',
      { funds: init_funds, admin: this.address, memo: 'https://fadroma.tech' }
    )
    this.log.debug(`gas used for init of code id ${code_id}:`, result.gasUsed)
    return {
      chainId: chainId!,
      address: result.contractAddress,
      codeHash: codeHash!,
      initBy: this.address,
      initTx: result.transactionHash,
      initGas: result.gasUsed,
      label,
    }
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
