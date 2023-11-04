import { Config } from '@hackbg/conf'
import type { ChainId } from '@fadroma/agent'
import {
  Agent, BatchBuilder,
  Console, Error, bold,
  bip32, bip39, bip39EN, bech32, base64,
  into,
  ContractInstance,
  Token
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
  declare api: Promise<CosmWasmClient|SigningCosmWasmClient>
  /** The bech32 prefix for the account's address  */
  bech32Prefix?: string
  /** The coin type in the HD derivation path */
  coinType?: number
  /** The account index in the HD derivation path */
  hdAccountIndex?: number
  /** The provided signer, which signs the transactions.
    * TODO: Implement signing transactions without external signer. */
  declare signer?: Signer

  constructor (properties?: Partial<CWAgent>) {
    // When not using an external signer, these must be
    // either defined in a subclass or passed to the constructor.
    super(properties as Partial<Agent>)
    this.coinType = properties?.coinType ?? this.coinType
    this.bech32Prefix = properties?.bech32Prefix ?? this.bech32Prefix
    this.hdAccountIndex = properties?.hdAccountIndex ?? this.hdAccountIndex
    this.log.debug('Connecting to', bold(this.url))
    this.api ??= CosmWasmClient.connect(this.url)
  }

  authenticate (options?: Parameters<Agent["authenticate"]>[0] & { signer?: Signer }) {
    if (!options) {
      throw new CWError("pass { mnemonic } or { signer } to this method")
    }
    let { signer, mnemonic } = options
    if (signer) {
      if (mnemonic) {
        throw new CWError("pass either mnemonic or signer, but not both")
      }
      return super.authenticate({
        ...options, api: SigningCosmWasmClient.connectWithSigner(this.url, signer)
      })
    } else {
      if (!mnemonic) {
        mnemonic = bip39.generateMnemonic(bip39EN)
        this.log.warn("No mnemonic provided, generated this one:", mnemonic)
      }
      return super.authenticate({
        ...options, ...consumeMnemonic(this, mnemonic)
      })
    }
  }

  async getBlockInfo (): Promise<Block> {
    return this.api.then(api=>api.getBlock())
  }

  get height () {
    return this.getBlockInfo().then(({ header: { height } })=>height)
  }

  get balance () {
    if (this.address) {
      return this.getBalance('uknow', this.address)
    } else {
      throw new Error('not authenticated, use getBalance')
    }
  }

  /** Query native token balance. */
  async getBalance (denom?: string, address?: Address): Promise<string> {
    this.log.debug('Querying balance of', bold(address), 'in', bold(denom))
    denom ??= this.defaultDenom
    address ??= this.address
    if (!address) {
      throw new Error('getBalance: pass address')
    }
    const { amount } = await this.api.then(api=>api.getBalance(address!, denom!))
    return amount
  }

  /** Stargate implementation of getting a code id. */
  async getCodeId (address: Address): Promise<CodeId> {
    if (!address) throw new CWError('chain.getCodeId: no address')
    const { codeId } = await this.api.then(api=>api.getContract(address))
    return String(codeId)
  }

  /** Stargate implementation of getting a code hash. */
  async getCodeHashOfAddress (address: Address): Promise<CodeHash> {
    const { codeId } = await this.api.then(api=>api.getContract(address))
    return this.getCodeHashOfCodeId(String(codeId))
  }

  /** Stargate implementation of getting a code hash. */
  async getCodeHashOfCodeId (codeId: CodeId): Promise<CodeHash> {
    const { checksum } = await this.api.then(api=>api.getCodeDetails(Number(codeId)))
    return checksum
  }

  /** Stargate implementation of getting a contract label. */
  async getLabel (address: Address): Promise<string> {
    if (!address) throw new CWError('chain.getLabel: no address')
    const { label } = await this.api.then(api=>api.getContract(address))
    return label
  }

  /** Stargate implementation of sending native token. */
  send (
    recipient: Address,
    amounts:   Token.ICoin[],
    options?:  Parameters<Agent["send"]>[2]
  ): Promise<void|unknown> {
    throw new Error('not implemented')
  }

  /** Stargate implementation of batch send. */
  sendMany (
    outputs:  [Address, Token.ICoin[]][],
    options?: Parameters<Agent["sendMany"]>[1]
  ): Promise<void|unknown> {
    throw new Error('not implemented')
  }

  protected async doUpload (data: Uint8Array): Promise<Partial<UploadedCode>> {
    if (!this.address) {
      throw new CWError("can't upload contract without sender address")
    }
    const api = await this.api
    if (!(api as SigningCosmWasmClient)?.upload) {
      throw new CWError("can't upload contract with an unauthenticated agent")
    } 
    const result = await (api as SigningCosmWasmClient).upload(
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
    if (!this.address) {
      throw new CWError("can't instantiate contract without sender address")
    }
    const api = await this.api
    if (!(api as SigningCosmWasmClient)?.instantiate) {
      throw new CWError("can't instantiate contract without authorizing the agent")
    } 
    const result = await (api as SigningCosmWasmClient).instantiate(
      this.address!,
      Number(codeId),
      options.initMsg,
      options.label!,
      options.initFee as StdFee,
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
    if (!this.address) {
      throw new CWError("can't execute transaction without sender address")
    }
    const api = await this.api
    if (!(api as SigningCosmWasmClient)?.execute) {
      throw new CWError("can't execute transaction without authorizing the agent")
    } 
    const {
      execSend,
      execMemo,
      execFee = this.fees?.exec || 'auto'
    } = options
    return await (api as SigningCosmWasmClient).execute(
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
    const api = await this.api
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
  const signer = {
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
  return {
    address,
    pubkey,
    signer,
    api: SigningCosmWasmClient.connectWithSigner(agent.url, signer)
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
    code:    Parameters<BatchBuilder<Agent>["upload"]>[0],
    options: Parameters<BatchBuilder<Agent>["upload"]>[1]
  ) {
    return this
  }

  instantiate (
    code:    Parameters<BatchBuilder<Agent>["instantiate"]>[0],
    options: Parameters<BatchBuilder<Agent>["instantiate"]>[1]
  ) {
    return this
  }

  execute (
    contract: Parameters<BatchBuilder<Agent>["execute"]>[0],
    options:  Parameters<BatchBuilder<Agent>["execute"]>[1]
  ) {
    return this
  }

  async submit () {}

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
