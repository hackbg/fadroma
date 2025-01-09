import type { Tendermint, Into, Address, ChainId } from '../deps.ts'
import type { UploadedCode, UploadStore, Contract } from './cwDeploy.ts'

/** A code ID, identifying uploaded code on a chain. */
export type CodeId = string|number
/** The hash of a contract's code. */
export type CodeHash = string
/** A contract's full unique on-chain label. */
export type Label = string
/** A transaction message that can be sent to a contract. */
export type Message = string|Record<string, unknown>

export type Deps = {
  query:   <T>(...args: unknown[])=>Promise<T>,
  execute: <T>(...args: unknown[])=>Promise<T>,
}

export type ContractConstructor<C extends Contract> = (...args: unknown[]) => C|Promise<C>

export type ContractMessage = string|number|boolean|object

export type Api = Tendermint.Api & {
  fetchCodeInfo ():
    Promise<Record<CodeId, UploadedCode>>
  fetchCodeInfo (codeId: CodeId, options?: { parallel?: boolean }):
    Promise<UploadedCode>
  fetchCodeInfo (codeIds: Iterable<CodeId>, options?: { parallel?: boolean }):
    Promise<Record<CodeId, UploadedCode>>

  fetchCodeInstances (codeId: CodeId):
    Promise<Record<Address, Contract>>
  fetchCodeInstances <C extends Contract> (Contract: ContractConstructor<C>, codeId: CodeId):
    Promise<Record<Address, C>>
  fetchCodeInstances (codeIds:  Iterable<CodeId>, options?: { parallel?: boolean }):
    Promise<Record<CodeId, Record<Address, Contract>>>
  fetchCodeInstances <C extends Contract> (Contract: C, codeIds:  Iterable<CodeId>, options?: { parallel?: boolean }):
    Promise<Record<CodeId, Record<Address, C>>>
  //fetchCodeInstances (codeIds: { [id: CodeId]: Contract }, options?: { parallel?: boolean }): Promise<{ [codeId in keyof typeof codeIds]:
    //Record<Address, InstanceType<typeof codeIds[codeId]>> }>

  fetchContractInfo (address: Address):
    Promise<Contract>
  fetchContractInfo <T extends Contract> (Contract: ContractConstructor<T>, address: Address):
    Promise<T>
  fetchContractInfo (addresses: Address[], options?: { parallel?: boolean }):
    Promise<Record<Address, Contract>>
  fetchContractInfo <T extends Contract> (Contract: T, addresses: Address[], options?:  { parallel?: boolean }):
    Promise<Record<Address, T>>
  //fetchContractInfo (contracts: { [address: Address]: Contract }, options?: { parallel?: boolean }):
    //Promise<{ [address in keyof typeof contracts]: InstanceType<typeof contracts[address]> }>

  queryContract <T> (contract: Address, message: ContractMessage):
    Promise<T>
  queryContract <T> (contract: { address: Address }, message: ContractMessage):
    Promise<T>

  /** Chain-specific implementation of code upload. */
  upload (parameters: {
    binary:       Uint8Array,
    reupload?:    boolean,
    uploadStore?: UploadStore,
    uploadFee?:   Tendermint.Fee
    uploadMemo?:  string
  }): Promise<Partial<UploadedCode & {
    chainId: ChainId,
    codeId:  CodeId
  }>>
  /** Chain-specific implementation of contract instantiation. */
  instantiate (parameters: Partial<Contract> & {
    initMsg:   Into<Message>
    initFee?:  Tendermint.Fee
    initSend?: Tendermint.Coin[]
    initMemo?: string
  }):
    Promise<Contract & { address: Address }>
  /** Chain-specific implementation of contract transaction. */
  execute <T> (parameters: {
    address:   Address
    codeHash?: string
    message:   Message
    execFee?:  Tendermint.Fee
    execSend?: Tendermint.Coin[]
    execMemo?: string
  }): Promise<T>
}
