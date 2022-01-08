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

## Implementation

```typescript
import type { IChain, IAgent, Identity, Gas } from './Model'
import { taskmaster, resolve, readFileSync } from '@fadroma/tools'
import assert from 'assert'

export abstract class BaseAgent implements IAgent {
  constructor (_options: Identity) {}

  readonly chain:   IChain
  readonly address: string
  readonly name:    string
  fees: Record<string, any>

  type?:     string
  pubkey?:   string
  mnemonic?: string
  keyPair?:  any
  pen?:      any

  abstract get nextBlock (): Promise<void>
  abstract get block     (): Promise<any>
  abstract get account   (): Promise<any>
  abstract get balance   (): Promise<any>

  abstract getBalance (
    denomination: string
  ): Promise<any>

  abstract send (
    recipient:        any,
    amount: string|number,
    denom?:           any,
    memo?:            any,
    fee?:             any
  ): Promise<any>

  abstract sendMany (
    txs: Array<any>,
    memo?:   string,
    denom?:  string,
    fee?:       any
  ): Promise<any>

  abstract upload (
    path:   string
  ): Promise<any>

  abstract instantiate (
    codeId: number,
    label:  string,
    initMsg:   any
  ): Promise<any>

  abstract query (
    link:      any,
    method: string,
    args?:     any
  ): Promise<any>

  abstract execute (
    link:      any,
    method: string,
    args?:     any,
    memo?:     any,
    transfer?: any,
    fee?:      any
  ): Promise<any>
}

/** Check if the passed instance has required methods to behave like an Agent */
export const isAgent = (maybeAgent: any): boolean => (
  maybeAgent
  && typeof maybeAgent         === "object"
  && typeof maybeAgent.query   === "function"
  && typeof maybeAgent.execute === "function")

export abstract class BaseGas implements Gas {
  //readonly abstract denom: string
  amount: Array<{amount: string, denom: string}> = []
  gas:    string
  constructor (x: number) {
    const amount = String(x)
    this.gas = amount
  }
}
```
