/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import type { Address, Message, Label, TxHash } from './base'
import { assign, Console, Error, base16, sha256 } from './base'
import type { ChainId } from './connec'
import { Connection, Endpoint, Devnet, Batch, Identity } from './connec'
import type { CodeId, CodeHash } from './deploy'
import { Compiler, SourceCode, CompiledCode, UploadedCode, ContractInstance } from './deploy'
import * as Token from './token'

class StubConnection extends Connection {
  static gasToken: Token.Native = new Token.Native('ustub')

  constructor (properties: Partial<Connection> = {}) {
    super(properties)
    this.endpoint ??= new StubEndpoint()
  }
  batch (): Batch<this> {
    return new StubBatch({ connection: this }) as Batch<this>
  }
}

class StubEndpoint extends Endpoint {
  state: StubBackend
  constructor (properties: Partial<StubEndpoint> = {}) {
    super(properties)
    assign(this, properties, ['state'])
    this.state ??= new StubBackend()
  }
  get height (): Promise<number> {
    return this.getBlockInfo().then(({height})=>height)
  }
  getBlockInfo () {
    return Promise.resolve({ height: + new Date() })
  }
  getBalance (...args: unknown[]): Promise<number> {
    this.log.warn('getBalance: stub')
    return Promise.resolve(0)
  }
  async getCodeId (address: Address): Promise<CodeId> {
    const contract = this.state.instances.get(address)
    if (!contract) {
      throw new Error(`unknown contract ${address}`)
    }
    return contract.codeId
  }
  getContractsByCodeId (id: CodeId) {
    this.log.warn('getContractsByCodeId: stub')
    return Promise.resolve([])
  }
  getCodeHashOfAddress (address: Address): Promise<CodeHash> {
    return this.getCodeId(address)
      .then(id=>this.getCodeHashOfCodeId(id))
  }
  getCodeHashOfCodeId (id: CodeId): Promise<CodeHash> {
    const code = this.state.uploads.get(id)
    if (!code) {
      throw new Error(`unknown code ${id}`)
    }
    return Promise.resolve(code.codeHash)
  }
  query <Q> (contract: { address: Address }, message: Message): Promise<Q> {
    return Promise.resolve({} as Q)
  }
  send (to: Address, amounts: Token.ICoin[], opts?: never): Promise<void> {
    return Promise.resolve()
  }
  sendMany (outputs: [Address, Token.ICoin[]][], opts?: never): Promise<void> {
    return Promise.resolve()
  }
  upload (codeData: Uint8Array): Promise<UploadedCode> {
    return Promise.resolve(new UploadedCode(this.state.upload(codeData)))
  }
  instantiate (
    codeId: CodeId, options: Parameters<Endpoint["instantiate"]>[1]
  ): Promise<ContractInstance & { address: Address }> {
    return Promise.resolve(new ContractInstance({
      address: 'stub',
      label: ''
    }) as ContractInstance & { address: Address })
  }
  execute (
    contract: { address: Address, codeHash: CodeHash },
    message:  Message,
    options?: Parameters<Endpoint["execute"]>[2]
  ): Promise<void|unknown> {
    return Promise.resolve({})
  }
}

class StubBackend extends Devnet {
  Connection = StubConnection

  chainId: string = 'stub'

  lastCodeId = 0

  balances = new Map<Address, Record<string, bigint>>()

  uploads = new Map<CodeId, {
    chainId: ChainId, codeId: CodeId, codeHash: CodeHash, codeData: Uint8Array
  }>()

  instances = new Map<Address, { codeId: CodeId }>()

  constructor (properties?: Partial<StubBackend>) {
    super(properties as Partial<Devnet>)
    assign(this, properties, ["chainId", "lastCodeId", "uploads", "instances"])
  }

  async start (): Promise<this> {
    this.running = true
    return this
  }

  async pause (): Promise<this> {
    this.running = false
    return this
  }

  async import (...args: unknown[]): Promise<unknown> {
    throw new Error("StubChainState#import: not implemented")
  }

  async export (...args: unknown[]): Promise<unknown> {
    throw new Error("StubChainState#export: not implemented")
  }

  async getGenesisAccount (name: string): Promise<Identity> {
    throw new Error("StubChainState#getAccount: not implemented")
  }


  upload (codeData: Uint8Array) {
    this.lastCodeId++
    const codeId = String(this.lastCodeId)
    let upload
    this.uploads.set(codeId, upload = {
      codeId,
      chainId:  this.chainId,
      codeHash: base16.encode(sha256(codeData)).toLowerCase(),
      codeData,
    })
    return upload
  }

  async instantiate (...args: unknown[]): Promise<Partial<ContractInstance> & {
    address: Address
  }> {
    throw new Error('not implemented')
    return { address: '' }
  }

  async execute (...args: unknown[]): Promise<unknown> {
    throw new Error('not implemented')
  }
}

class StubBatch extends Batch<StubConnection> {
  messages: object[] = []

  upload (...args: Parameters<StubConnection["upload"]>) {
    this.messages.push({ instantiate: args })
    return this
  }

  instantiate (...args: Parameters<StubConnection["instantiate"]>) {
    this.messages.push({ instantiate: args })
    return this
  }

  execute (...args: Parameters<StubConnection["execute"]>) {
    this.messages.push({ execute: args })
    return this
  }

  async submit () {
    this.log.debug('Submitted batch:', this.messages)
    return this.messages
  }
}

/** A compiler that does nothing. Used for testing. */
export class StubCompiler extends Compiler {
  caching = false

  id = 'stub'

  log = new Console('StubCompiler')

  async build (
    source: string|Partial<SourceCode>, ...args: any[]
  ): Promise<CompiledCode> {
    return new CompiledCode({
      codePath: 'stub',
      codeHash: 'stub',
    })
  }
}

export {
  StubConnection as Connection,
  StubEndpoint   as Endpoint,
  StubBackend    as Backend,
  StubBatch      as Batch,
  StubCompiler   as Compiler,
}
