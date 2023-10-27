import type { Address, CodeHash, Message, CodeId, ICoin, Label } from './agent-base'
import { Chain, Agent } from './agent-chain'
import type { ExecOpts } from './agent-chain'
import { ContractTemplate, ContractInstance } from './agent-contract'

export class StubChain extends Chain {

  defaultDenom = 'stub'

  getApi (): {} {
    this.log.warn('chain.getApi: this function is stub; use a subclass of Chain')
    return Promise.resolve({})
  }

  /** Get the current block height. */
  get height (): Promise<number> {
    this.log.warn('chain.height: this getter is stub; use a subclass of Chain')
    return Promise.resolve(+ new Date())
  }

  /** Stub implementation of getting native balance. */
  getBalance (denom: string, address: Address): Promise<string> {
    this.log.warn('chain.getBalance: this function is stub; use a subclass of Chain')
    return Promise.resolve('0')
  }

  /** Stub implementation of querying a smart contract. */
  query <Q> (
    contract: Address|{ address: Address, codeHash?: CodeHash }, msg: Message
  ): Promise<Q> {
    this.log.warn('chain.query: this function is stub; use a subclass of Chain')
    return Promise.resolve({} as Q)
  }

  /** Stub implementation of getting a code id. */
  getCodeId (address: Address): Promise<CodeId> {
    this.log.warn('chain.getCodeId: this function is stub; use a subclass of Chain')
    return Promise.resolve('code-id-stub')
  }

  /** Stub implementation of getting a code hash. */
  getHash (address: Address|number): Promise<CodeHash> {
    this.log.warn('chain.getHash: this function is stub; use a subclass of Chain')
    return Promise.resolve('code-hash-stub')
  }

  /** Stub implementation of getting a contract label. */
  getLabel (address: Address): Promise<string> {
    this.log.warn('chain.getLabel: this function is stub; use a subclass of Chain')
    return Promise.resolve('contract-label-stub')
  }

}

export class StubAgent extends Agent {

  constructor (options: Partial<StubAgent> = {}) {
    super(options)
    this.chain ??= new StubChain({ id: 'stub', url: 'stub' })
  }

  /** Stub implementation of sending native token. */
  send (to: Address, amounts: ICoin[], opts?: ExecOpts): Promise<void|unknown> {
    this.log.warn('Agent#send: this function is stub; use a subclass of Agent')
    return Promise.resolve()
  }

  /** Stub implementation of batch send. */
  sendMany (outputs: [Address, ICoin[]][], opts?: ExecOpts): Promise<void|unknown> {
    this.log.warn('Agent#sendMany: this function is stub; use a subclass of Agent')
    return Promise.resolve()
  }

  /** Stub implementation of code upload. */
  protected doUpload (data: Uint8Array): Promise<ContractTemplate> {
    this.log.warn('Agent#upload: this function is stub; use a subclass of Agent')
    return Promise.resolve(new ContractTemplate({
      chainId:  this.chain!.id,
      codeId:   '0',
      codeHash: 'stub-code-hash'
    }))
  }

  /** Stub implementation of contract init */
  protected doInstantiate (
    codeId:  CodeId,
    options: {
      label:      Label,
      initMsg:    Message,
      initFee?:   ICoin[]|'auto',
      initFunds?: ICoin[],
      initMemo?:  string,
    }
  ): Promise<ContractInstance & {
    address: Address
  }> {
    this.log.warn('Agent#instantiate: this function is stub; use a subclass of Agent')
    return Promise.resolve(new ContractInstance({
      chainId:  this.chain!.id,
      address:  'stub',
      codeHash: '',
      label:    ''
    }) as ContractInstance & { address: Address })
  }

  /** Stub implementation of calling a mutating method. */
  protected doExecute (
    contract: { address: Address, codeHash: CodeHash },
    msg:      Message,
    opts?:    ExecOpts
  ): Promise<void|unknown> {
    this.log.warn('Agent#execute: this function is stub; use a subclass of Agent')
    return Promise.resolve({})
  }

}
