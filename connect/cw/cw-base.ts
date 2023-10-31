import { Config } from '@hackbg/conf'
import type { ChainId, ICoin } from '@fadroma/agent'
import {
  Agent, BatchBuilder,
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

/** Generic agent for CosmWasm-enabled chains. */
class CWAgent extends Agent {
  defaultDenom = ''
  /** Public key corresponding to private key derived from mnemonic. */
  publicKey?: Uint8Array
  /** API handle. */
  declare api: CosmWasmClient|SigningCosmWasmClient
  /** The bech32 prefix for the account's address  */
  bech32Prefix?: string
  /** The coin type in the HD derivation path */
  coinType?: number
  /** The account index in the HD derivation path */
  hdAccountIndex?: number
  /** The provided signer, which signs the transactions.
    * TODO: Implement signing transactions without external signer. */
  signer?: Signer

  constructor (properties?: Partial<CWAgent>) {
    // When not using an external signer, these must be
    // either defined in a subclass or passed to the constructor.
    super(properties as Partial<Agent>)
    this.coinType = properties?.coinType ?? this.coinType
    this.bech32Prefix = properties?.bech32Prefix ?? this.bech32Prefix
    this.hdAccountIndex = properties?.hdAccountIndex ?? this.hdAccountIndex
  }

  async authenticate (options?: Parameters<Agent["authenticate"]>[0] & { signer?: Signer }) {
    if (!options) {
      throw new CWError("pass { mnemonic } or { signer } to this method")
    }
    let { signer, mnemonic } = options
    if (signer) {
      if (mnemonic) {
        throw new CWError("pass either mnemonic or signer, but not both")
      }
      return super.authenticate(options)
    } else {
      if (!mnemonic) {
        mnemonic = bip39.generateMnemonic(bip39EN)
        this.log.warn("No mnemonic provided, generated this one:", mnemonic)
      }
      const agent = await super.authenticate(options)
      const auth = consumeMnemonic(this, mnemonic)
      agent.address = auth.address
      agent.signer = auth.signer
      agent.api = await SigningCosmWasmClient.connectWithSigner(agent.url, auth.signer)
      return agent
    }
  }

  async getApi (): Promise<CosmWasmClient> {
    return await CosmWasmClient.connect(this.url)
  }

  async getBlockInfo (): Promise<Block> {
    return this.api.getBlock()
  }

  get height () {
    return this.getBlockInfo().then(({ header: { height } })=>height)
  }

  /** One-shot async initialization of agent.
    * Populates the `api` property with a SigningCosmWasmClient. */
  get ready (): Promise<this & { api: SigningCosmWasmClient }> {
    const init = new Promise<this & { api: SigningCosmWasmClient }>(async (resolve, reject)=>{
      if (!this.api) {
        if (this.devnet) {
          await this.devnet.start()
          if (!this.address && this.name) {
            Object.assign(this, await this.devnet.getAccount(this.name))
          }
        }
        if (!this.signer) throw new CWError("the agent's signer property is not set")
        const api = await SigningCosmWasmClient.connectWithSigner(this.url, this.signer)
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
    if (!address) {
      throw new Error('getBalance: pass address')
    }
    const { amount } = await api.getBalance(address!, denom)
    return amount
  }

  /** Stargate implementation of getting a code id. */
  async getCodeId (address: Address): Promise<CodeId> {
    const { api } = await this.ready
    if (!address) throw new CWError('chain.getCodeId: no address')
    const { codeId } = await api.getContract(address)
    return String(codeId)
  }

  /** Stargate implementation of getting a code hash. */
  async getCodeHashOfAddress (address: Address): Promise<CodeHash> {
    const { codeId } = await this.api.getContract(address)
    return this.getCodeHashOfCodeId(String(codeId))
  }

  /** Stargate implementation of getting a code hash. */
  async getCodeHashOfCodeId (codeId: CodeId): Promise<CodeHash> {
    const { checksum } = await this.api.getCodeDetails(Number(codeId))
    return checksum
  }

  /** Stargate implementation of getting a contract label. */
  async getLabel (address: Address): Promise<string> {
    const { api } = await this.ready
    if (!address) throw new CWError('chain.getLabel: no address')
    const { label } = await api.getContract(address)
    return label
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
      chainId:   this.chainId,
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
    if (!options.label) {
      throw new CWError("can't instantiate without label")
    }
    const result = await api.instantiate(
      this.address!,
      Number(codeId),
      options.initMsg,
      options.label,
      options.initFee || 'auto',
      { admin: this.address, funds: options.initSend, memo: options.initMemo }
    )
    return {
      codeId,
      codeHash: options.codeHash,
      label:    options.label,
      initMsg:  options.initMsg,
      chainId:  this.chainId,
      address:  result.contractAddress,
      initTx:   result.transactionHash,
      initGas:  result.gasUsed,
      initBy:   this.address,
      initFee:  options.initFee || 'auto',
      initSend: options.initSend,
      initMemo: options.initMemo
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

  /** Stargate implementation of querying a smart contract. */
  protected async doQuery <U> (contract: Address|Partial<ContractInstance>, msg: Message): Promise<U> {
    if (typeof contract === 'string') contract = { address: contract }
    if (!contract.address) throw new CWError('no contract address')
    const { api } = await this.ready
    return await api.queryContractSmart(contract.address, msg) as U
  }

  batch (): CWBatchBuilder {
    return new CWBatchBuilder(this)
  }
}

export function consumeMnemonic (agent: CWAgent, mnemonic: string): {
  address: Address, pubkey: Uint8Array, signer: Signer
} {
  // Validate input
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
  // Compute public key and address
  const pubkey = secp256k1.getPublicKey(new Uint8Array(privateKey), true);
  const address = bech32.encode(agent.bech32Prefix, bech32.toWords(ripemd160(sha256(pubkey))))
  return {
    address,
    pubkey,
    // Construct signer
    signer: {
      // One account per agent
      getAccounts: async () => [
        { algo: 'secp256k1', address, pubkey }
      ],
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
class CWBatchBuilder extends BatchBuilder<CWAgent> {

  upload (
    code:    Parameters<BatchBuilder<Agent>>["upload"][0],
    options: Parameters<BatchBuilder<Agent>>["upload"][1]
  ) {
  }

  instantiate (
    code:    Parameters<BatchBuilder<Agent>>["instantiate"][0],
    options: Parameters<BatchBuilder<Agent>>["instantiate"][1]
  ) {
  }

  execute (
    contract: Parameters<BatchBuilder<Agent>>["execute"][0],
    options:  Parameters<BatchBuilder<Agent>>["execute"][1]
  ) {
  }

}

export {
  CWConfig as Config,
  CWError as Error,
  CWConsole as Console,
  CWAgent as Agent,
  CWBatchBuilder as BatchBuilder
}

class CWConfig extends Config {}

class CWError extends Error {}

class CWConsole extends Console {
  label = '@fadroma/cw'
}
