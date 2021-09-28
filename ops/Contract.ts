import type { Chain } from './ChainAPI'
import type { Agent } from './Agent'

export type ContractCodeOptions = {
  workspace?: string
  crate?:     string
  artifact?:  string
  codeHash?:  string
}

export type ContractUploadOptions = ContractCodeOptions & {
  agent?:  Agent
  chain?:  Chain
  codeId?: number
}

export type ContractInitOptions = ContractUploadOptions & {
  agent?:   Agent
  address?: string
  prefix?:  string
  label?:   string
  initMsg?: Record<any, any>
}

export type ContractAPIOptions = ContractInitOptions & {
  schema?: Record<string, any>,
}

export interface Contract {

  save (): this

  // Compilation. Implemented in ContractBuild
  code: {
    workspace?: string
    crate?:     string
    artifact?:  string
    codeHash?:  string
  }
  readonly workspace?: string
  readonly crate?:     string
  readonly artifact?:  string
  readonly codeHash?:  string
  build (workspace?: string, crate?: string): Promise<any>

  // Upload. Implemented in ContractUpload
  blob: {
    chain?:    Chain
    agent?:    Agent
    codeId?:   number
    codeHash?: string
    receipt?: {
      codeId:             number
      compressedChecksum: string
      compressedSize:     string
      logs:               Array<any>
      originalChecksum:   string
      originalSize:       number
      transactionHash:    string
    }
  }
  readonly chain:         Chain
  readonly uploader:      Agent
  readonly uploadReceipt: any
  readonly codeId:        number
  upload (chainOrAgent?: Chain|Agent): Promise<any>

  // Instantiation. Implemented in ContractInit
  init: {
    prefix?:  string
    agent?:   Agent
    address?: string
    label?:   string
    msg?:     any
    tx?: {
      contractAddress: string
      data:            string
      logs:            Array<any>
      transactionHash: string
    }
  }
  readonly instantiator: Agent
  readonly address:      string
  readonly link:         { address: string, code_hash: string }
  readonly linkPair:     [ string, string ]
  readonly label:        string
  readonly initMsg:      any
  readonly initTx:       any
  readonly initReceipt:  any
  instantiate (agent?: Agent): Promise<any>

  // Operation. Implemented in ContractCaller;
  // extra methods added by ContractAPI
  query (method: string, args: any, agent?: Agent): any
  execute (method: string, args: any, memo: string, 
           transferAmount: Array<any>, fee: any, agent?: Agent): any
}

export const attachable = (Constructor: new()=>Contract) => (
  address:  string,
  codeHash: string,
  agent:    Agent
) => {
  const instance = new Constructor({})
  instance.init.agent = agent
  instance.init.address = address
  instance.blob.codeHash = codeHash
  return instance
}
