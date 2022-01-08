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

## API

```typescript
import type { IChainNode } from './ChainNode.ts.md'
import type { Identity, IAgent } from './Agent.ts.md'
import type { IContract } from './ContractClient.ts.md'

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

## Implementation

```typescript
import { Console } from '@fadroma/tools'
import { URL } from 'url'
const console = Console(import.meta.url)
```

```typescript
import {
  __dirname,
  Directory,
  bold, symlinkDir, mkdirp, resolve, basename,
  readdirSync, statSync, existsSync, readlinkSync, readFileSync, unlinkSync,
  colors
} from '@fadroma/tools'


export type DefaultIdentity =
  null |
  string |
  { name?: string, address?: string, mnemonic?: string } |
  IAgent

/* Represents an interface to a particular Cosmos blockchain.
 * Used to construct `Agent`s and `Contract`s that are
 * bound to a particular chain. */
export abstract class BaseChain implements IChain {
  chainId?: string
  apiURL?:  URL
  node?:    IChainNode

  /** Credentials of the default agent for this network. */
  defaultIdentity?: DefaultIdentity

  /** Stuff that should be in the constructor but is asynchronous.
    * FIXME: How come nobody has proposed sugar for async constructors yet?
    * Feeling like writing a `@babel/plugin-async-constructor`, as always
    * bonus internet points for whoever beats me to it. */
  abstract readonly ready: Promise<this>

  /** The connection address is stored internally as a URL object,
    * but returned as a string.
    * FIXME why so? */
  abstract get url (): string

  /** Get an Agent that works with this Chain. */
  abstract getAgent (options?: Identity): Promise<IAgent>

  /** Get a Contract that exists on this Chain, or a non-existent one
    * which you can then create via Agent#instantiate
    *
    * FIXME: awkward inversion of control */
  abstract getContract<T> (api: new()=>T, address: string, agent: any): T

  /** This directory contains all the others. */
  readonly stateRoot:  Directory

  /** This directory stores all private keys that are available for use. */
  readonly identities: Directory

  /** This directory stores receipts from the upload transactions,
    * containing provenance info for uploaded code blobs. */
  readonly uploads:    Directory

  /** This directory stores receipts from the instantiation (init) transactions,
    * containing provenance info for initialized contract instances.
    *
    * NOTE: the current domain vocabulary considers initialization and instantiation,
    * as pertaining to contracts on the blockchain, to be the same thing. */
  abstract readonly instances: ChainInstancesDir

  abstract printStatusTables (): void

  readonly isMainnet?:  boolean
  readonly isTestnet?:  boolean
  readonly isLocalnet?: boolean
  constructor ({ isMainnet, isTestnet, isLocalnet }: IChainState = {}) {
    this.isMainnet  = isMainnet
    this.isTestnet  = isTestnet
    this.isLocalnet = isLocalnet
  }

  printActiveInstance () {
    if (this.instances.active) {
      console.log(`\nSelected instance:`)
      console.log(`  ${bold(this.instances.active.name)}`)
      for (const contract of Object.keys(this.instances.active.contracts)) {
        console.log(`    ${colors.green('✓')}  ${contract}`)
      }
    } else {
      console.log(`\nNo selected instance.`)
    }
  }

  printIdentities () {
    console.log('\nAvailable identities:')
    for (const identity of this.identities.list()) {
      console.log(`  ${this.identities.load(identity).address} (${bold(identity)})`)
    }
  }
}


/// ### Instances
/// The instance directory is where results of deployments are stored.


export class ChainInstancesDir extends Directory {

  KEY = '.active'

  get active () {
    const path = resolve(this.path, this.KEY)
    if (!existsSync(path)) {
      return null
    }

    const instanceName = basename(readlinkSync(path))
    const contracts = {}
    for (const contract of readdirSync(path).sort()) {
      const [contractName, _version] = basename(contract, '.json').split('@')
      const location = resolve(path, contract)
      contracts[contractName] = JSON.parse(readFileSync(location, 'utf8'))
    }

    return {
      name: instanceName,
      path,
      resolve: (...fragments: Array<string>) => resolve(path, ...fragments),
      contracts,
      getContract (
        Class: (new () => IContract) & {attach: Function},
        contractName: string,
        admin:        IAgent
      ) {
        const receipt = contracts[contractName]
        if (!receipt) {
          throw new Error(
            `@fadroma/ops: no contract ${bold(contractName)}` +
            ` in deployment ${bold(instanceName)}`
          )
        }
        const {initTx:{contractAddress}, codeId: _codeId, codeHash} = receipt
        return Class.attach(contractAddress, codeHash, admin)
      }
    }
  }

  async select (id: string) {
    const selection = resolve(this.path, id)
    if (!existsSync(selection)) throw new Error(
      `@fadroma/ops: ${id} does not exist`)
    const active = resolve(this.path, this.KEY)
    if (existsSync(active)) unlinkSync(active)
    await symlinkDir(selection, active)
  }

  list () {
    if (!existsSync(this.path)) {
      console.info(`\n${this.path} does not exist, creating`)
      mkdirp.sync(this.path)
      return []
    }

    return readdirSync(this.path)
      .filter(x=>x!=this.KEY)
      .filter(x=>statSync(resolve(this.path, x)).isDirectory())
  }

  save (name: string, data: any) {
    if (data instanceof Object) data = JSON.stringify(data, null, 2)
    return super.save(`${name}.json`, data)
  }
}
```
