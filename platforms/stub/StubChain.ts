/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import type { Address, ChainId, CodeId, CodeHash } from '@hackbg/fadroma'
import {
  assign, randomBech32, base16, SHA256,
  Identity, Backend, Chain, Connection, Contract, UploadedCode, Token,
} from '@hackbg/fadroma'

import { StubBatch, StubBlock } from './StubTx'
import { StubAgent, StubIdentity } from './StubIdentity'
import { StubBackend } from './StubBackend'

export class StubChain extends Chain {
  constructor (
    properties: Omit<ConstructorParameters<typeof Chain>[0], 'chainId'>
      & Partial<Pick<ConstructorParameters<typeof Chain>[0], 'chainId'>>
      & Partial<Pick<StubChain, 'backend'>> = {}
  ) {
    super({ chainId: 'stub', ...properties })
    assign(this, properties, ['backend'])
    this.backend ??= new StubBackend({})
  }

  backend: StubBackend

  authenticate (): Promise<StubAgent>
  authenticate (mnemonic: string): Promise<StubAgent>
  authenticate (identity: Identity): Promise<StubAgent>
  async authenticate (...args: unknown[]): Promise<StubAgent> {
    let identity: Identity
    if (!args[0]) {
      identity = new StubIdentity()
    } else if (typeof args[0] === 'string') {
      identity = new StubIdentity({ mnemonic: args[0] })
    } else if (args[0] instanceof StubIdentity) {
      identity = args[0]
    } else if (typeof args[0] === 'object') {
      identity = new StubIdentity(args[0])
    } else {
      throw Object.assign(new Error('Invalid arguments'), { args })
    }
    return new StubAgent({
      chain: this,
      identity
    })
  }

  getConnection (): StubConnection {
    return new StubConnection({ chain: this, url: 'stub', })
  }
}

export class StubConnection extends Connection {
  constructor (properties: ConstructorParameters<typeof Connection>[0]) {
    super(properties)
    assign(this, properties, ['backend'])
  }

  get chain (): StubChain {
    return super.chain as StubChain
  }

  get backend (): StubBackend {
    return this.chain.backend
  }

  override fetchHeightImpl () {
    return this.fetchBlockImpl().then(({height})=>height)
  }

  override fetchBlockImpl (): Promise<StubBlock> {
    const timestamp = new Date()
    return Promise.resolve(new StubBlock({
      chain:        this.chain,
      id:           `stub${+timestamp}`,
      height:       +timestamp,
      timestamp:    timestamp.toISOString(),
      transactions: []
    }))
  }

  override fetchBalanceImpl (
    ...args: Parameters<Connection["fetchBalanceImpl"]>
  ) {
    throw new Error('unimplemented!')
    //token ??= this.defaultDenom
    //const balance = (this.backend.balances.get(address!)||{})[token] ?? 0
    //return Promise.resolve(String(balance))
    return Promise.resolve({})
  }

  override fetchCodeInfoImpl (
    ...args: Parameters<Connection["fetchCodeInfoImpl"]>
  ):
    Promise<Record<string, UploadedCode>>
  {
    if (!args[0]) {
      throw new Error('Invalid argument')
    }
    if (!args[0].codeIds) {
      return Promise.resolve(Object.fromEntries(
        [...this.backend.uploads.entries()].map(
          ([key, val])=>[key, new UploadedCode(val)]
        )
      ))
    } else {
      const results: Record<string, UploadedCode> = {}
      for (const id of args[0].codeIds) {
        results[id] = new UploadedCode(this.backend.uploads.get(id))
      }
      return Promise.resolve(results)
    }
  }

  override async fetchCodeInstancesImpl (
    ...args: Parameters<Connection["fetchCodeInstancesImpl"]>
  ) {
    throw new Error('unimplemented!')
    return {}
    //return Promise.resolve([...this.backend.uploads.get(id)!.instances]
      //.map(address=>({address})))
  }

  override fetchContractInfoImpl (
    ...args: Parameters<Connection["fetchContractInfoImpl"]>
  ):
    Promise<Record<Address, Contract>>
  {
    const results: Record<Address, Contract> = {}
    for (const address of Object.keys(args[0].contracts)) {
      const contract = this.backend.instances.get(address)
      if (!contract) {
        throw new Error(`unknown contract ${address}`)
      }
      const { codeId } = contract
      const code = this.backend.uploads.get(codeId)
      if (!code) {
        throw new Error(`inconsistent state: missing code ${codeId} for address ${address}`)
      }
      results[address] = new Contract({
        ...code,
        ...contract,
      })
    }
    return Promise.resolve(results)
  }

  override queryImpl <T> (
    ...args: Parameters<Connection["queryImpl"]>
  ): Promise<T> {
    return Promise.resolve({} as T)
  }
}
