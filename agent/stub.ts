/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import type { Address, Message, Label, TxHash } from './base'
import { Console } from './base'
import type { ICoin } from './token'
import { Agent, Batch } from './chain'
import { Builder, CompiledCode, UploadedCode } from './code'
import type { CodeHash, CodeId, SourceCode } from './code'
import { ContractInstance } from './deploy'

class StubAgent extends Agent {

  protected lastCodeHash = 0

  defaultDenom: string = 'ustub'

  async getBlockInfo () {
    return { height: + new Date() }
  }

  get height (): Promise<number> {
    return this.getBlockInfo().then(({height})=>height)
  }

  async getContractCodeId (txhash: TxHash) {
    return 'stub-code-id'
  }

  async getContractCodeHash (address: Address) {
    return 'stub-code-hash'
  }

  async getCodeHash (id: CodeId) {
    return 'stub-code-hash'
  }

  doQuery <Q> (contract: { address: Address }, message: Message): Promise<Q> {
    return Promise.resolve({} as Q)
  }

  send (to: Address, amounts: ICoin[], opts?: never): Promise<void> {
    return Promise.resolve()
  }

  sendMany (outputs: [Address, ICoin[]][], opts?: never): Promise<void> {
    return Promise.resolve()
  }

  protected doUpload (data: Uint8Array): Promise<UploadedCode> {
    this.lastCodeHash = this.lastCodeHash + 1
    return Promise.resolve(new UploadedCode({
      chainId:  this.chainId,
      codeId:   String(this.lastCodeHash),
    }))
  }

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

  protected doExecute (
    contract: { address: Address, codeHash: CodeHash },
    message:  Message,
    options?: Parameters<Agent["doExecute"]>[2]
  ): Promise<void|unknown> {
    return Promise.resolve({})
  }

}

class StubBatch extends Batch {}

export {
  StubAgent   as Agent,
  StubBatch   as Batch,
  StubBuilder as Builder,
}

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
