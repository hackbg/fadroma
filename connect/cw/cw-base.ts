import { Config } from '@hackbg/conf'

import {
  Chain, assertChain, bindChainSupport,
  Agent, Bundle,
  ICoin,
  Console, Error, bold,
  bip32, bip39, bip39EN, bech32, base64,
  into
} from '@fadroma/agent'

import type {
  Address, Client, Contract, Message, ExecOpts,
  Uploadable, Uploaded, Instantiated
} from '@fadroma/agent'

import { CosmWasmClient, SigningCosmWasmClient } from '@hackbg/cosmjs-esm'
import type { logs, OfflineSigner as Signer } from '@hackbg/cosmjs-esm'

import { ripemd160 } from "@noble/hashes/ripemd160"
import { sha256 } from "@noble/hashes/sha256"
import { secp256k1 } from "@noble/curves/secp256k1"
import { numberToBytesBE } from "@noble/curves/abstract/utils"

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
    if (this.isDevnet && !this.devnet) {
      throw new Error('Missing devnet handle')
    }
    const init = new Promise<this & { api: CosmWasmClient }>(async (resolve, reject)=>{
      if (this.isDevnet) {
        await this.devnet!.start()
      }
      if (!this.api) {
        if (!this.chain) {
          throw new CWError('no chain specified')
        }
        const api = await CosmWasmClient.connect(this.url)
        this.api = api
      }
      return resolve(this as this & { api: CosmWasmClient })
    })
    Object.defineProperty(this, 'ready', { get () { return init } })
    return init
  }

}

/** Generic agent for CosmWasm-enabled chains. */
class CWAgent extends Agent {

  constructor (options: Partial<CWAgent> = {}) {
    super(options)

    // These must be either defined in a subclass or passed to the constructor.
    this.coinType = options.coinType ?? this.coinType
    if (this.coinType === undefined) {
      throw new CWError('coinType is not set')
    }
    this.bech32Prefix = options.bech32Prefix ?? this.bech32Prefix
    if (this.bech32Prefix === undefined) {
      throw new CWError('bech32Prefix is not set')
    }
    this.hdAccountIndex = options.hdAccountIndex ?? this.hdAccountIndex
    if (this.hdAccountIndex === undefined) {
      throw new CWError('hdAccountIndex is not set')
    }

    if (options.signer) {

      // When passing external signer, ignore the mnemonic.
      this.signer = options.signer
      if (options.mnemonic) {
        this.log.warn('Both signer and mnemonic were provided. Ignoring mnemonic.')
      }

    } else {

      // When not passing external signer, create one from the mnemonic.
      let mnemonic = options.mnemonic
      if (!mnemonic) {
        mnemonic = bip39.generateMnemonic(bip39EN)
        this.log.warn("No mnemonic provided, generated this one:", mnemonic)
      }

      // Derive keypair and address from mnemonic
      const seed = bip39.mnemonicToSeedSync(mnemonic)
      const node = bip32.HDKey.fromMasterSeed(seed)
      const secretHD = node.derive(`m/44'/${this.coinType}'/0'/0/${this.hdAccountIndex}`)
      const privateKey = secretHD.privateKey
      if (!privateKey) {
        throw new CWError("failed to derive key pair")
      }
      const pubkey = secp256k1.getPublicKey(new Uint8Array(privateKey), true);
      Object.defineProperty(this, 'publicKey', {
        enumerable: true, writable: false, value: pubkey
      })
      const address = bech32.encode(
        this.bech32Prefix, bech32.toWords(ripemd160(sha256(pubkey)))
      )
      Object.defineProperty(this, 'address', {
        enumerable: true, writable: false, value: address
      })
      this.name ??= this.address

      // Construct signer
      this.signer = {
        getAccounts: () => Promise.resolve([
          { address, algo: 'secp256k1', pubkey }
        ]),
        signAmino: async (address, signed) => {
          const digest = sha256(JSON.stringify(signed))
          if (digest.length !== 32) {
            throw new Error(`Invalid length of digest to sign: ${digest.length}`)
          }
          const signature = secp256k1.sign(digest, privateKey)
          return {
            signed,
            signature: encodeSecp256k1Signature(pubkey, new Uint8Array([
              ...numberToBytesBE(signature.r, 32),
              ...numberToBytesBE(signature.s, 32)
            ])),
          }
        },
      }

    }
  }

  /** Public key corresponding to private key derived from mnemonic. */
  publicKey?: Uint8Array

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
  signer: Signer

  /** Async initialization. Populates the `api` property. */
  get ready (): Promise<this & { api: SigningCosmWasmClient }> {
    const init = new Promise<this & { api: SigningCosmWasmClient }>(async (resolve, reject)=>{
      if (!this.api) {
        if (!this.chain) {
          throw new CWError('no chain specified')
        }
        const api = await SigningCosmWasmClient.connectWithSigner(this.chain.url, this.signer)
        this.api = api
      }
      return resolve(this as this & { api: SigningCosmWasmClient })
    })
    Object.defineProperty(this, 'ready', { get () { return init } })
    return init
  }

  /** Query native token balance. */
  async getBalance (denom?: string, address?: Address): Promise<string> {
    const { api } = await this.ready
    denom ??= this.defaultDenom
    address ??= this.address
    const { amount } = await api.getBalance(address!, denom)
    return amount
  }

  async upload (data: Uint8Array, meta?: Partial<Uploadable>): Promise<Uploaded> {
    const { api } = await this.ready
    if (!this.address) throw new Error.Missing.Address()
    const {
      checksum,
      originalSize,
      compressedSize,
      codeId,
      logs,
      height,
      transactionHash,
      events,
      gasWanted,
      gasUsed
    } = await api.upload(
      this.address,
      data,
      this.fees?.upload || 'auto',
      "Uploaded by Fadroma"
    )
    return {
      chainId:   assertChain(this).id,
      codeId:    String(codeId),
      codeHash:  await this.getHash(Number(codeId)),
      uploadBy:  this.address,
      uploadTx:  transactionHash,
      uploadGas: gasUsed
    }
  }

  /** Instantiate a contract. */
  async instantiate <C extends Client> (
    instance: Contract<C>,
    init_funds: ICoin[] = [],
    memo: string = '',
  ): Promise<Instantiated> {
    const { api } = await this.ready
    if (!this.address) throw new Error("Agent has no address")
    if (instance.address) {
      this.log.warn("Instance already has address, not instantiating.")
      return instance as Instantiated
    }
    const { chainId, codeId, codeHash, label, initMsg } = instance
    const code_id = Number(instance.codeId)
    if (isNaN(code_id)) {
      throw new Error.Missing.CodeId()
    }
    if (!label) {
      throw new Error.Missing.Label()
    }
    if (!initMsg) {
      throw new Error.Missing.InitMsg()
    }
    if (chainId && chainId !== assertChain(this).id) {
      throw new Error.Invalid.WrongChain()
    }
    const result = await api.instantiate(
      this.address,
      code_id,
      await into(initMsg),
      label,
      this.fees?.init || 'auto',
      { funds: init_funds, admin: this.address, memo }
    )
    this.log.debug(`gas used for init of code id ${code_id}:`, result.gasUsed)
    return {
      chainId:  chainId!,
      address:  result.contractAddress,
      codeHash: codeHash!,
      initBy:   this.address,
      initTx:   result.transactionHash,
      initGas:  result.gasUsed,
      label,
    }
  }

  /** Call a transaction method of a contract. */
  async execute (
    instance: Partial<Client>, msg: Message, opts: ExecOpts = {}
  ): Promise<unknown> {
    const { api } = await this.ready
    if (!this.address) throw new CWError("No agent address")
    if (!instance.address) throw new CWError("No contract address")
    const { address, codeHash } = instance
    const { send, memo, fee = this.fees?.exec || 'auto' } = opts
    return await api.execute(this.address, instance.address, msg, fee, memo, send)
  }

  /** Query a contract. */
  async query <U> (instance: Partial<Client>, query: Message): Promise<U> {
    const { api } = await this.ready
    if (!instance.address) throw new CWError('No contract address')
    return await api.queryContractSmart(instance.address, query) as U
  }

}

function encodeSecp256k1Signature (pubkey: Uint8Array, signature: Uint8Array): {
  pub_key: { type: string, value: string },
  signature: string
} {
  if (pubkey.length !== 33 || (pubkey[0] !== 0x02 && pubkey[0] !== 0x03)) {
    throw new CWError(
      "Public key must be compressed secp256k1, i.e. 33 bytes starting with 0x02 or 0x03"
    )
  }
  if (signature.length !== 64) {
    throw new CWError(
      "Signature must be 64 bytes long. Cosmos SDK uses a 2x32 byte fixed length encoding "+
      "for the secp256k1 signature integers r and s."
    )
  }
  return {
    pub_key: { type: "tendermint/PubKeySecp256k1", value: base64.encode(pubkey), },
    signature: base64.encode(signature)
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
