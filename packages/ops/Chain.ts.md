# Fadroma Ops: the `IChain` family of interfaces,
# or, test-staging-prod for the blockchain

Implementors of this class represent existing blockchains,
and provide access to the identities and smart contracts
that exist on those blockchains.

Furthermore, `Chain`s keep track of keys to identities,
and info about uploaded and instantiated contracts
belonging to a project. This data is normally stored
in a subdirectory called `artifacts` and is meant to
be committed to Git in the case of testnet and mainnet
deployments.

**TODO** Rename `instances` to `deployments`?

```typescript
export interface IChainOptions {
  chainId?: string
  apiURL?:  URL
  node?:    IChainNode
  defaultIdentity?: Identity
}

export interface IChain extends IChainOptions {
  readonly url:   string
  readonly ready: Promise<this>

  getAgent (options?: Identity): Promise<IAgent>
  getContract<T> (api: new()=>T, address: string, agent: IAgent): T

  readonly stateRoot?:  Directory
  readonly identities?: Directory
  readonly uploads?:    Directory
  readonly instances?:  Directory
}

export interface IChainConnectOptions extends IChainOptions {
  apiKey?:     string
  identities?: Array<string>
}

export interface IChainState extends IChainOptions {
  readonly isMainnet?:  boolean
  readonly isTestnet?:  boolean
  readonly isLocalnet?: boolean

  readonly stateRoot?:  string
  readonly identities?: string
  readonly uploads?:    string
  readonly instances?:  string
}
```

