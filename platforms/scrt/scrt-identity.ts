import { base64, Chain, Identity, Agent, SigningConnection } from '@hackbg/fadroma'
import type { ChainId, CodeHash, Message } from '@hackbg/fadroma'
import { SecretNetworkClient, Wallet } from '@hackbg/secretjs-esm'
import type { EncryptionUtils } from '@hackbg/secretjs-esm'
import { ScrtError as Error, bold, colors, assign, Bip39, Bip39EN } from './scrt-base'
import { ScrtChain, ScrtConnection } from './scrt-chain'
import { ScrtBatch } from './scrt-tx'
import * as ScrtBank from './scrt-bank'
import * as ScrtCompute from './scrt-compute'
import * as ScrtStaking from './scrt-staking'
import * as ScrtGovernance from './scrt-governance'

export class ScrtAgent extends Agent {
  constructor (properties: ConstructorParameters<typeof Agent>[0]) {
    super(properties)
    if (!(this.identity instanceof ScrtIdentity)) {
      if (!(typeof this.identity === 'object')) {
        throw new Error('identity must be ScrtIdentity instance, { mnemonic }, or { encryptionUtils }')
      } else if ((this.identity as { mnemonic?: string }).mnemonic) {
        this.log.debug('Identifying with mnemonic')
        this.identity = new ScrtMnemonicIdentity(this.identity)
      } else if ((this.identity as { encryptionUtils?: unknown }).encryptionUtils) {
        this.log.debug('Identifying with signer (encryptionUtils)')
        this.identity = new ScrtSignerIdentity(this.identity)
      } else {
        throw new Error('identity must be ScrtIdentity instance, { mnemonic }, or { encryptionUtils }')
      }
    }
    this.#connection = new ScrtSigningConnection({ chain: this.chain, identity: this.identity })
  }

  declare chain:    ScrtChain
  declare identity: ScrtIdentity
  #connection: ScrtSigningConnection
  override getConnection () {
    return this.#connection
  }
  override batch (): ScrtBatch {
    return new ScrtBatch({ agent: this })
  }

  /** Set permissive fees by default. */
  fees = {
    upload: ScrtConnection.gasToken.fee(10000000),
    init:   ScrtConnection.gasToken.fee(10000000),
    exec:   ScrtConnection.gasToken.fee(1000000),
    send:   ScrtConnection.gasToken.fee(1000000),
  }

  async setMaxGas (): Promise<this> {
    const { gas } = await this.chain.fetchLimits()
    const max = ScrtConnection.gasToken.fee(gas)
    this.fees = { upload: max, init: max, exec: max, send: max }
    return this
  }

  get account (): ReturnType<SecretNetworkClient['query']['auth']['account']> {
    return this.getConnection().api.query.auth.account({ address: this.address })
  }

  async getNonce (): Promise<{ accountNumber: number, sequence: number }> {
    const result: any = await this.account ?? (() => {
      throw new Error(`Cannot find account "${this.address}", make sure it has a balance.`)
    })()
    const { account_number, sequence } = result.account
    return { accountNumber: Number(account_number), sequence: Number(sequence) }
  }

  async encrypt (codeHash: CodeHash, msg: Message) {
    if (!codeHash) {
      throw new Error("can't encrypt message without code hash")
    }
    const { encryptionUtils } = this.getConnection().api as any
    const encrypted = await encryptionUtils.encrypt(codeHash, msg as object)
    return base64.encode(encrypted)
  }
}

export class ScrtSigningConnection extends SigningConnection {
  constructor (
    properties: Omit<ConstructorParameters<typeof SigningConnection>[0], 'identity'>
      & { identity: ScrtIdentity, url: string|URL }
  ) {
    super(properties)
    this.api = this.identity.getApi({
      chainId: this.chain.chainId,
      url:     properties.url
    })
  }
  api: SecretNetworkClient
  get identity (): ScrtIdentity {
    return super.identity as unknown as ScrtIdentity
  }
  async sendImpl (...args: Parameters<SigningConnection["sendImpl"]>) {
    return await ScrtBank.send(this, ...args)
  }
  async uploadImpl (...args: Parameters<SigningConnection["uploadImpl"]>) {
    return await ScrtCompute.upload(this, ...args)
  }
  async instantiateImpl (...args: Parameters<SigningConnection["instantiateImpl"]>) {
    return await ScrtCompute.instantiate(this, ...args)
  }
  async executeImpl <T> (...args: Parameters<SigningConnection["executeImpl"]>): Promise<T> {
    return await ScrtCompute.execute(this, ...args) as T
  }
}

export abstract class ScrtIdentity extends Identity {
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
      chainId,
      url: url.toString(),
      encryptionUtils: this.encryptionUtils
    })
  }
}

export class ScrtMnemonicIdentity extends ScrtIdentity {
  wallet: Wallet
  constructor ({
    mnemonic = Bip39.generateMnemonic(Bip39EN),
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
      chainId,
      url: url.toString(),
      wallet,
      walletAddress: wallet.address,
    })
  }
}
