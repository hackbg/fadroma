/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import type { Address, Message, Label } from './base'
import type { CodeHash, CodeId } from './code'
import type { ICoin } from './token'
import { Chain, Agent } from './chain'
import { Batch } from './batch'
import { Builder, UploadedCode, CompiledCode } from './code'
import { ContractInstance } from './deploy'
import { Console } from './base'

/** A builder that does nothing. Used for testing. */
export class StubBuilder extends Builder {
  caching = false

  id = 'stub'

  log = new Console('StubBuilder')

  async build (
    source: string|Partial<SourceCode>, ...args: any[]
  ): Promise<CompiledCode> {
    return new CompiledCode({
      codePath: 'stub',
      codeHash: 'stub',
    })
  }

  async buildMany (
    sources: (string|Partial<CompiledCode>)[], ...args: unknown[]
  ): Promise<CompiledCode[]> {
    return Promise.all(sources.map(source=>new CompiledCode({
      codePath: 'stub',
      codeHash: 'stub',
    })))
  }
}

export class StubChain extends Chain {

  defaultDenom = 'ustub'

  getApi (): {} {
    return Promise.resolve({})
  }

  /** Get the current block height. */
  get height (): Promise<number> {
    return Promise.resolve(+ new Date())
  }

  /** Stub implementation of getting native balance. */
  getBalance (denom: string, address: Address): Promise<string> {
    return Promise.resolve('0')
  }

  /** Stub implementation of querying a smart contract. */
  query <Q> (
    contract: Address|{ address: Address, codeHash?: CodeHash }, message: Message
  ): Promise<Q> {
    return Promise.resolve({} as Q)
  }

  /** Stub implementation of getting a code id. */
  getCodeId (address: Address): Promise<CodeId> {
    return Promise.resolve('code-id-stub')
  }

  /** Stub implementation of getting a code hash. */
  getHash (address: Address|number): Promise<CodeHash> {
    return Promise.resolve('code-hash-stub')
  }

  /** Stub implementation of getting a contract label. */
  getLabel (address: Address): Promise<string> {
    return Promise.resolve('contract-label-stub')
  }

}

export class StubAgent extends Agent {

  constructor (options: Partial<StubAgent> = {}) {
    super(options)
    this.chain ??= new StubChain({ id: 'stub', url: 'stub' })
  }

  /** Stub implementation of sending native token. */
  send (to: Address, amounts: ICoin[], opts?: never): Promise<void|unknown> {
    return Promise.resolve()
  }

  /** Stub implementation of batch send. */
  sendMany (outputs: [Address, ICoin[]][], opts?: never): Promise<void|unknown> {
    return Promise.resolve()
  }

  protected lastCodeHash = 0

  /** Stub implementation of code upload. */
  protected doUpload (data: Uint8Array): Promise<UploadedCode> {
    this.lastCodeHash = this.lastCodeHash + 1
    return Promise.resolve(new UploadedCode({
      chainId:  this.chain!.id,
      codeId:   String(this.lastCodeHash),
    }))
  }

  /** Stub implementation of contract init */
  protected doInstantiate (
    codeId:  CodeId,
    options: Parameters<Agent["doInstantiate"]>[1]
  ): Promise<ContractInstance & {
    address: Address
  }> {
    return Promise.resolve(new ContractInstance({
      address: 'stub',
      label: ''
    }) as ContractInstance & { address: Address })
  }

  /** Stub implementation of calling a mutating method. */
  protected doExecute (
    contract: { address: Address, codeHash: CodeHash },
    message:  Message,
    options?: Parameters<Agent["doExecute"]>[2]
  ): Promise<void|unknown> {
    return Promise.resolve({})
  }

}

export class StubBatch extends Batch {}
