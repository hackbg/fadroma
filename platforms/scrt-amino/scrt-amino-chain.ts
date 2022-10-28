import { Scrt } from '@fadroma/scrt'
import type { AgentClass, Address } from '@fadroma/scrt'
import type { ScrtAminoAgent } from './scrt-amino-agent'
import type { ScrtAminoConfig } from './scrt-amino-config'

/** Represents the Secret Network, accessed via Amino/HTTP. */
export class ScrtAmino extends Scrt {
  static Agent: Fadroma.AgentClass<ScrtAminoAgent> // populated below
  static Config: typeof ScrtAminoConfig
  static defaultMainnetAminoUrl: string|null = null
  static defaultTestnetAminoUrl: string|null = null
  static Chains = {
    async 'ScrtAminoMainnet' (config: ScrtAminoConfig) {
      const mode = Fadroma.ChainMode.Mainnet
      const id   = config.scrtMainnetChainId  ?? Fadroma.Scrt.defaultMainnetChainId
      const url  = config.scrtMainnetAminoUrl ?? ScrtAmino.defaultMainnetAminoUrl ?? undefined
      return new ScrtAmino(id, { url, mode })
    },
    async 'ScrtAminoTestnet' (config: ScrtAminoConfig) {
      const mode = Fadroma.ChainMode.Testnet
      const id   = config.scrtTestnetChainId  ?? Fadroma.Scrt.defaultTestnetChainId
      const url  = config.scrtTestnetAminoUrl ?? ScrtAmino.defaultTestnetAminoUrl ?? undefined
      return new ScrtAmino(id, { url, mode })
    },
    // devnet and mocknet modes are defined in @fadroma/connect
  }

  Agent: Fadroma.AgentClass<ScrtAminoAgent> = ScrtAmino.Agent
  api = new SecretJS.CosmWasmClient(this.url)
  get block () {
    return this.api.getBlock()
  }
  get height () {
    return this.block.then(block=>block.header.height)
  }
  /** Get up-to-date balance of this address in specified denomination. */
  async getBalance (denomination: string = this.defaultDenom, address: Fadroma.Address) {
    const account = await this.api.getAccount(address)
    const balance = account?.balance || []
    const inDenom = ({denom}:{denom:string}) => denom === denomination
    const balanceInDenom = balance.filter(inDenom)[0]
    if (!balanceInDenom) return '0'
    return balanceInDenom.amount
  }
  async getHash (idOrAddr: number|string) {
    const { api } = this
    if (typeof idOrAddr === 'number') {
      return await api.getCodeHashByCodeId(idOrAddr)
    } else if (typeof idOrAddr === 'string') {
      return await api.getCodeHashByContractAddr(idOrAddr)
    } else {
      throw new TypeError('getCodeHash id or addr')
    }
  }
  async getCodeId (address: Fadroma.Address) {
    const { api } = this
    const { codeId } = await api.getContract(address)
    return String(codeId)
  }
  async getLabel (address: Fadroma.Address) {
    const { api } = this
    const { label } = await api.getContract(address)
    return label
  }
  async query <T, U> ({ address, codeHash }: Partial<Fadroma.Client>, msg: T) {
    const { api } = this
    // @ts-ignore
    return api.queryContractSmart(address, msg, undefined, codeHash)
  }
  /** Create a `ScrtAminoAgent` on this `chain`.
    * You can optionally pass a compatible subclass as a second argument. */
  async getAgent (
    options: Partial<ScrtAminoAgentOpts> = {},
    _Agent:  Fadroma.AgentClass<ScrtAminoAgent> = this.Agent
  ): Promise<ScrtAminoAgent> {
    const { name = 'Anonymous', ...args } = options
    let   { mnemonic, keyPair } = options
    // select authentication method
    switch (true) {
      case !!mnemonic:
        // if keypair doesnt correspond to the mnemonic, delete the keypair
        if (keyPair && mnemonic !== privKeyToMnemonic(keyPair.privkey)) {
          log.warnKeypair()
          keyPair = null
        }
        break
      case !!keyPair:
        // if there's a keypair but no mnemonic, generate mnemonic from keyapir
        mnemonic = privKeyToMnemonic(keyPair!.privkey)
        break
      default:
        // if there is neither, generate a new keypair and corresponding mnemonic
        keyPair  = SecretJS.EnigmaUtils.GenerateNewKeyPair()
        mnemonic = privKeyToMnemonic(keyPair.privkey)
    }
    // construct options object
    options = {
      ...args,
      chain: this,
      name,
      mnemonic,
      pen: await SecretJS.Secp256k1Pen.fromMnemonic(mnemonic!),
      keyPair
    }
    // construct agent
    return await super.getAgent(options, _Agent) as ScrtAminoAgent
  }
}

export const privKeyToMnemonic = (privKey: Uint8Array): string =>
  bip39.entropyToMnemonic(privKey, bip39EN)
