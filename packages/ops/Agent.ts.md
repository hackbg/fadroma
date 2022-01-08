# Fadroma Ops: the `IAgent` family of interfaces,
# or, how to manage Secret Agents

## Identities

```typescript
export type Identity = {
  chain?:    IChain,
  address?:  string

  name?:     string,
  type?:     string,
  pubkey?:   string
  mnemonic?: string
  keyPair?:  any
  pen?:      any
  fees?:     any
}
```

```typescript
export interface IAgent extends Identity {
  readonly chain:   IChain
  readonly address: string
  readonly name:    string
  fees: Record<string, any>

  readonly nextBlock: Promise<void>
  readonly block: Promise<any>
  readonly account: Promise<any>
  readonly balance: Promise<any>

  getBalance  (denomination: string): Promise<any>
  send        (to: any, amount: string|number, denom?: any, memo?: any, fee?: any): Promise<any>
  sendMany    (txs: Array<any>, memo?: string, denom?: string, fee?: any): Promise<any>
  upload      (path: string): Promise<any>
  instantiate (codeId: number, label: string, initMsg: any): Promise<any>
  query       (link: any, method: string, args?: any): Promise<any>
  execute     (link: any, method: string, args?: any, memo?: any, send?: any, fee?: any): Promise<any>
}

export type AgentConstructor = new (...args: any) => IAgent
```

```typescript
export type Constructor = new (...args: any) => any
```

