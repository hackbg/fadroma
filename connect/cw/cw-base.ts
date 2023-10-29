import { Config } from '@hackbg/conf'

import {
  Chain, ChainId, assertChain, bindChainSupport,
  Agent, Batch,
  ICoin,
  Console, Error, bold,
  bip32, bip39, bip39EN, bech32, base64,
  into,
  ContractInstance
} from '@fadroma/agent'

import type { Address, Message, CodeId, CodeHash, UploadedCode, Label } from '@fadroma/agent'

import { CosmWasmClient, SigningCosmWasmClient, serializeSignDoc } from '@hackbg/cosmjs-esm'
import type { logs, OfflineSigner as Signer, Block, StdFee } from '@hackbg/cosmjs-esm'

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
  declare api?: CosmWasmClient

  async getApi (): Promise<CosmWasmClient> {
    return await CosmWasmClient.connect(this.url)
  }

  get block (): Promise<Block> {
    return this.ready.then(({api})=>api.getBlock())
  }

  get height () {
    return this.block.then(block=>Number(block.header.height))
  }

  /** Stargate implementation of getting native balance. */
  async getBalance (denom: string, address: Address): Promise<string> {
    const { api } = await this.ready
    denom ??= this.defaultDenom
    if (!address) {
      throw new Error('getBalance: pass address')
    }
    const { amount } = await api.getBalance(address, denom)
    return amount
  }

  /** Stargate implementation of querying a smart contract. */
  async query <U> (contract: Address|Partial<ContractInstance>, msg: Message): Promise<U> {
    if (typeof contract === 'string') contract = { address: contract }
    if (!contract.address) throw new CWError('chain.query: no contract address')
    const { api } = await this.ready
    return await api.queryContractSmart(contract.address, msg) as U
  }

  /** Stargate implementation of getting a code id. */
  async getCodeId (address: Address): Promise<CodeId> {
    const { api } = await this.ready
    if (!address) throw new CWError('chain.getCodeId: no address')
    const { codeId } = await api.getContract(address)
    return String(codeId)
  }

  /** Stargate implementation of getting a code hash. */
  async getHash (addressOrCodeId: Address|number): Promise<CodeHash> {
    const { api } = await this.ready
    if (!addressOrCodeId) 
    if (typeof addressOrCodeId === 'number') {
      const { checksum } = await api.getCodeDetails(addressOrCodeId)
      return checksum
    } else if (typeof addressOrCodeId === 'string') {
      const { codeId } = await api.getContract(addressOrCodeId)
      const { checksum } = await api.getCodeDetails(codeId)
      return checksum
    }
    throw new CWError('chain.getHash: pass address (as string) or code id (as number)')
  }

  /** Stargate implementation of getting a contract label. */
  async getLabel (address: Address): Promise<string> {
    const { api } = await this.ready
    if (!address) throw new CWError('chain.getLabel: no address')
    const { label } = await api.getContract(address)
    return label
  }

}

/** Generic agent for CosmWasm-enabled chains. */
class CWAgent extends Agent {

  constructor (options: Partial<CWAgent> = {}) {
    super(options as Partial<Agent>)

    // When not using an external signer, these must be
    // either defined in a subclass or passed to the constructor.
    this.coinType = options.coinType ?? this.coinType
    this.bech32Prefix = options.bech32Prefix ?? this.bech32Prefix
    this.hdAccountIndex = options.hdAccountIndex ?? this.hdAccountIndex

    // When setting mnemonic, construct a signer.
    Object.defineProperty(this, 'mnemonic', {
      get () {
        throw new Error('mnemonic is write-only')
      },
      set (mnemonic: string) {
        setMnemonic(this, mnemonic)
      }
    })

    if (options.signer) {
      // When passing external signer, ignore the mnemonic.
      this.signer = options.signer
      if (options.mnemonic) {
        this.log.warn('Both signer and mnemonic were provided. Ignoring mnemonic.')
      }
    } else if (options.mnemonic) {
      // When not passing external signer, create one from the mnemonic.
      let mnemonic = options.mnemonic
      if (!mnemonic) {
        mnemonic = bip39.generateMnemonic(bip39EN)
        this.log.warn("No mnemonic provided, generated this one:", mnemonic)
      }
      this.mnemonic = mnemonic
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
  signer?: Signer

  /** One-shot async initialization of agent.
    * Populates the `api` property with a SigningCosmWasmClient. */
  get ready (): Promise<this & { api: SigningCosmWasmClient }> {
    const init = new Promise<this & { api: SigningCosmWasmClient }>(async (resolve, reject)=>{
      if (!this.api) {
        if (!this.chain) throw new CWError("the agent's chain property is not set")
        if (this.chain?.devnet) {
          await this.chain?.devnet.start()
          if (!this.address && this.name) {
            Object.assign(this, await this.chain?.devnet.getAccount(this.name))
          }
        }
        if (!this.signer) throw new CWError("the agent's signer property is not set")
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

  /** Stargate implementation of sending native token. */
  send (
    recipient: Address,
    amounts:   ICoin[],
    options?:  Parameters<Agent["send"]>[2]
  ): Promise<void|unknown> {
    throw new Error('not implemented')
  }

  /** Stargate implementation of batch send. */
  sendMany (
    outputs:  [Address, ICoin[]][],
    options?: Parameters<Agent["sendMany"]>[1]
  ): Promise<void|unknown> {
    throw new Error('not implemented')
  }

  protected async doUpload (data: Uint8Array): Promise<Partial<UploadedCode>> {
    const { api } = await this.ready
    if (!this.address) throw new Error.Missing.Address()
    const result = await api.upload(
      this.address, data, this.fees?.upload || 'auto', "Uploaded by Fadroma"
    )
    return {
      chainId:   assertChain(this).id,
      codeId:    String(result.codeId),
      codeHash:  result.checksum,
      uploadBy:  this.address,
      uploadTx:  result.transactionHash,
      uploadGas: result.gasUsed
    }
  }

  /** Instantiate a contract via CosmJS Stargate. */
  protected async doInstantiate (
    codeId:  CodeId,
    options: Parameters<Agent["doInstantiate"]>[1]
  ): Promise<Partial<ContractInstance>> {
    const { api } = await this.ready
    const result = await api.instantiate(
      this.address!,
      Number(codeId),
      options.initMsg,
      options.label,
      options.initFee || 'auto',
      { admin: this.address, funds: options.initFunds, memo: options.initMemo }
    )
    return {
      codeId,
      codeHash:  options.codeHash,
      label:     options.label,
      initMsg:   options.initMsg,
      chainId:   assertChain(this).id,
      address:   result.contractAddress,
      initTx:    result.transactionHash,
      initGas:   result.gasUsed,
      initBy:    this.address,
      initFee:   options.initFee || 'auto',
      initFunds: options.initFunds,
      initMemo:  options.initMemo
    }
  }

  /** Call a transaction method of a contract. */
  protected async doExecute (
    contract: { address: Address },
    message:  Message,
    options:  Parameters<Agent["execute"]>[2] = {}
  ): Promise<unknown> {
    const { api } = await this.ready
    if (!this.address) throw new CWError("agent.execute: no agent address")
    const {
      execSend,
      execMemo,
      execFee = this.fees?.exec || 'auto'
    } = options
    return await api.execute(
      this.address,
      contract.address,
      message,
      execFee,
      execMemo,
      execSend
    )
  }

  /** Query a contract. */
  async query <U> (
    contract: Address|Partial<ContractInstance>,
    message:  Message
  ): Promise<U> {
    if (typeof contract === 'string') contract = new ContractInstance({ address: contract })
    if (!contract.address) throw new CWError('agent.query: no contract address')
    const { api } = await this.ready
    return await api.queryContractSmart(contract.address, message) as U
  }

}

function setMnemonic (agent: CWAgent, mnemonic: string) {
  if (!mnemonic) {
    throw new CWError("can't set empty mnemonic")
  }
  if (agent.coinType === undefined) {
    throw new CWError('coinType is not set')
  }
  if (agent.bech32Prefix === undefined) {
    throw new CWError('bech32Prefix is not set')
  }
  if (agent.hdAccountIndex === undefined) {
    throw new CWError('hdAccountIndex is not set')
  }
  // Derive keypair and address from mnemonic
  const seed = bip39.mnemonicToSeedSync(mnemonic)
  const node = bip32.HDKey.fromMasterSeed(seed)
  const secretHD = node.derive(`m/44'/${agent.coinType}'/0'/0/${agent.hdAccountIndex}`)
  const privateKey = secretHD.privateKey
  if (!privateKey) {
    throw new CWError("failed to derive key pair")
  }
  // Compute public key
  const pubkey = secp256k1.getPublicKey(new Uint8Array(privateKey), true);
  Object.defineProperty(agent, 'publicKey', {
    enumerable: true, writable: false, value: pubkey
  })
  // Compute and assign address
  const address = bech32.encode(
    agent.bech32Prefix, bech32.toWords(ripemd160(sha256(pubkey)))
  )
  Object.defineProperty(agent, 'address', {
    enumerable: true, writable: false, value: address
  })
  agent.name ??= agent.address

  // Construct signer
  agent.signer = {

    // Returns only one account
    getAccounts: () => Promise.resolve([{ algo: 'secp256k1', address, pubkey }]),

    // Sign a transaction
    signAmino: async (address: string, signed: any) => {
      if (address && (address !== agent.address)) {
        agent.log.warn(`Passed address ${address} did not match agent address ${agent.address}`)
      }
      const { r, s } = secp256k1.sign(sha256(serializeSignDoc(signed)), privateKey)
      return {
        signed,
        signature: encodeSecp256k1Signature(pubkey, new Uint8Array([
          ...numberToBytesBE(r, 32), ...numberToBytesBE(s, 32)
        ])),
      }
    },

  }
}

export function encodeSecp256k1Signature (pubkey: Uint8Array, signature: Uint8Array): {
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

/** Transaction batch for CosmWasm-enabled chains. */
class CWBatch extends Batch {}

export {
  CWConfig  as Config,
  CWError   as Error,
  CWConsole as Console,
  CWChain   as Chain,
  CWAgent   as Agent,
  CWBatch   as Batch
}

bindChainSupport(CWChain, CWAgent, CWBatch)
