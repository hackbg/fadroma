// Contract deployment /////////////////////////////////////////////////////////////////////////////

export abstract class ContractConfig {
  readonly workspace: string
  readonly crate:     string
  readonly label:     string
  readonly initMsg:   any = {}
}

export interface Contract {
  readonly workspace?: string
  readonly crate?:     string
  readonly artifact?:  string
  readonly codeHash?:  string
  build (workspace?: string, crate?: string): Promise<any>

  readonly chain:         Chain
  readonly uploader:      Agent
  readonly uploadReceipt: any
  readonly codeId:        number
  upload (chainOrAgent?: Chain|Agent): Promise<any>

  readonly instantiator: Agent
  readonly address:      string
  readonly link:         { address: string, code_hash: string }
  readonly linkPair:     [ string, string ]
  readonly label:        string
  readonly initMsg:      any
  readonly initTx:       any
  readonly initReceipt:  any
  instantiate (agent?: Agent): Promise<any>

  query (method: string, args: any, agent?: Agent): any
  execute (method: string, args: any, memo: string, 
           transferAmount: Array<any>, fee: any, agent?: Agent): any

  setPrefix (prefix: string): this
  save (): this
}
