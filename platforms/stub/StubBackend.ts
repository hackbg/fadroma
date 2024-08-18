import type { Address, CodeId, ChainId, CodeHash } from '@hackbg/fadroma'
import {
  Backend, Token, assign, randomBech32, base16, SHA256, Identity, Contract
} from '@hackbg/fadroma'

export type StubAccount = { address: Address, mnemonic?: string }
export type StubBalances = Record<string, bigint>
export type StubInstance = { codeId: CodeId, address: Address, initBy: Address }
export type StubUpload = {
  chainId:   ChainId,
  codeId:    CodeId,
  codeHash:  CodeHash,
  codeData:  Uint8Array,
  instances: Set<Address>
}

export class StubBackend extends Backend {
  gasToken   = new Token.Native('ustub')
  prefix     = 'stub1'
  chainId    = 'stub'
  url        = 'http://stub'
  alive      = true
  lastCodeId = 0
  accounts   = new Map<string, StubAccount>()
  balances   = new Map<Address, StubBalances>()
  uploads    = new Map<CodeId, StubUpload>()
  instances  = new Map<Address, StubInstance>()

  constructor (
    properties: ConstructorParameters<typeof Backend>[0]
      & Partial<Pick<StubBackend, 'gasToken'|'prefix'|'chainId'|'url'|'alive'|'lastCodeId'>>
      & Partial<Pick<StubBackend, 'accounts'|'balances'|'uploads'|'instances'>>
      & { genesisAccounts?: Record<string, string|number> } = {}
  ) {
    super(properties as Partial<Backend>)
    assign(this, properties, [
      "chainId",
      "lastCodeId",
      "uploads",
      "instances",
      "gasToken",
      "prefix"
    ])
    for (const [name, balance] of Object.entries(properties?.genesisAccounts||{})) {
      const address = randomBech32(this.prefix)
      const balances = this.balances.get(address) || {}
      balances[this.gasToken.denom] = BigInt(balance)
      this.balances.set(address, balances)
      this.accounts.set(name, { address })
    }
  }

  getIdentity (name: string): Promise<Identity> {
    return Promise.resolve(new Identity({
      name,
      ...this.accounts.get(name)
    }))
  }

  start (): Promise<this> {
    this.alive = true
    return Promise.resolve(this)
  }

  pause (): Promise<this> {
    this.alive = false
    return Promise.resolve(this)
  }

  import (...args: unknown[]): Promise<unknown> {
    throw new Error("StubChainState#import: not implemented")
  }

  export (...args: unknown[]): Promise<unknown> {
    throw new Error("StubChainState#export: not implemented")
  }

  async upload (codeData: Uint8Array) {
    this.lastCodeId++
    const codeId = String(this.lastCodeId)
    const chainId = this.chainId
    const codeHash = base16.encode(SHA256(codeData)).toLowerCase()
    const upload = { codeId, chainId, codeHash, codeData, instances: new Set<string>() }
    this.uploads.set(codeId, upload)
    return upload
  }

  async instantiate (args: { initBy: Address, codeId: CodeId }):
    Promise<Contract & { address: Address }>
  {
    const { codeId, initBy } = args
    const address = randomBech32(this.prefix)
    const code = this.uploads.get(codeId)
    if (!code) {
      throw new Error(`invalid code id ${args.codeId}`)
    }
    code.instances.add(address)
    this.instances.set(address, { address, codeId, initBy })
    return new Contract({ address, codeId }) as Contract & { address: Address }
  }

  async execute (...args: unknown[]): Promise<unknown> {
    throw new Error('not implemented')
  }
}
