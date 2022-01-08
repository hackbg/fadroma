### Gas handling

```typescript
export type Gas = {
  amount: Array<{amount: string, denom: string}>
  gas:    string
}

export type Fees = {
  upload: Gas
  init:   Gas
  exec:   Gas
  send:   Gas
}
```

#### Prefund

```typescript
export type Prefund = {
  /** Taskmaster. TODO replace with generic observability mechanism (RxJS?) */
  task?:       Function
  /** How many identities to create */
  count?:      number
  /** How many native tokens to send to each identity */
  budget?:     bigint
  /** On which chain is this meant to happen? */
  chain?:      IChain
  /** Agent that distributes the tokens -
   *  needs to have sufficient balance
   *  e.g. genesis account on localnet) */
  agent?:      IAgent
  /** Map of specific recipients to receive funds. */
  recipients?: Record<any, {agent: IAgent}>
  /** Map of specific identities to receive funds.
   *  FIXME redundant with the above*/
  identities?: any
}
```

