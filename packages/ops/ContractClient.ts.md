# Fadroma Ops: the `IContract` family of interfaces,
# or, the many aspects of a smart contract's lifecycle

Since this module only contains type definitions, it is light on the imports.
`URL` from Node.js core is used to parse URLs; `Directory` and `JSONFile`
come from [`@fadroma/tools`](../tools) and provide a clean API for accessing
the filesystem (which is used as Fadroma's main datastore).

```typescript
import type { URL } from 'url'
import type { Directory, JSONFile } from '@fadroma/tools'
```

## Contract API

### Interacting with a smart contract

* Finally, a contract instance can be queried with the `query` method,
  and transactions can be executed with `execute`.
* The schema helpers in [Schema.ts](./Schema.ts)
  automatically generate wrapper methods around `query` and `execute`.

```typescript
import type { IAgent } from './Agent.ts.md'
import { isAgent } from './Agent.ts.md'

export type IContract = {
  query   (method: string, args: any, agent?: IAgent): any
  execute (method: string, args: any, memo: string, send: Array<any>, fee: any, agent?: IAgent): any
}

export type ContractAPIOptions = ContractInitOptions & {
  schema?: Record<string, any>,
}

export abstract class ContractCaller extends ContractInit {

  private backoffOptions = {
    retry (error: Error, attempt: number) {
      if (error.message.includes('500')) {
        console.warn(`Error 500, retry #${attempt}...`)
        console.warn(error)
        return false
      }
      if (error.message.includes('502')) {
        console.warn(`Error 502, retry #${attempt}...`)
        console.warn(error)
        return true
      }
      return false
    }
  }

  private backoff (fn: ()=>Promise<unknown>) {
    return backOff(fn, this.backoffOptions)
  }

  /** Query the contract. */
  query (method = "", args = null, agent = this.instantiator) {
    return this.backoff(() => agent.query(this, method, args))
  }

  /** Execute a contract transaction. */
  execute (
    method = "",
    args   = null,
    memo   = '',
    amount: unknown[] = [],
    fee:    unknown   = undefined,
    agent:  IAgent    = this.instantiator
  ) {
    return this.backoff(() => agent.execute(this, method, args, memo, amount, fee))
  }

  /** Create a temporary copy of a contract with a different agent.
    * FIXME: Broken - see uploader/instantiator/admin */
  copy = (agent: IAgent) => {
    const addon = {};
    if (isAgent(agent)) {
      // @ts-ignore: ???
      addon.init = {...this.init, agent};
    }
    return Object.assign(
      Object.create(Object.getPrototypeOf(this)),
      addon
    );
  };

}

export type Schema   = Record<string, unknown>
export type Validate = (object: unknown) => unknown
export type Method   = (...args: Array<unknown>) => unknown

import { loadSchemas, getAjv, SchemaFactory } from './Schema'
/** A contract with auto-generated methods for invoking
 *  queries and transactions */
export abstract class ContractAPI extends ContractCaller implements IContract {

  static loadSchemas = loadSchemas

  protected schema: {
    initMsg?:        Schema
    queryMsg?:       Schema
    queryResponse?:  Schema
    handleMsg?:      Schema
    handleResponse?: Schema
  } = {}

  #ajv = getAjv()

  private validate: {
    initMsg?:        Validate
    queryMsg?:       Validate
    queryResponse?:  Validate
    handleMsg?:      Validate
    handleResponse?: Validate
  } = {}

  q:  Record<string, Method>
  tx: Record<string, Method>

  constructor (options: ContractAPIOptions = {}) {
    super(options)
    if (options.schema) this.schema = options.schema
    this.q  = new SchemaFactory(this, this.schema?.queryMsg).create()
    this.tx = new SchemaFactory(this, this.schema?.handleMsg).create()
    for (const [msg, schema] of Object.entries(this.schema)) {
      if (schema) {
        this.validate[msg] = this.#ajv.compile(schema)
      }
    }
  }

}
```

### State types

The `IContract` interface requires 3 properties which are kind of magic:
* `code: ContractCodeOptions`
* `blob: UploadState`
* `init: InitState`

These hold the contract state, select fields of which are exposed via
the getters on `IContract` (as implemented by [`BaseContract`](./Contract.ts)).
The intent behind this is threefold:
* To group internal state for each stage of the process
* To provide quick access to commonly needed values
* To discourage mutation of internal state


## Implementation

```typescript


import { ContractCode } from './ContractBuild'

type ContractConstructor = new (options: unknown) => IContract

export const attachable =
  (Constructor: ContractConstructor) =>
    (address: string, codeHash: string, agent: IAgent) => {
      const instance = new Constructor({})
      instance.init.agent = agent
      instance.init.address = address
      instance.blob.codeHash = codeHash
      return instance
    }

import { Console } from '@fadroma/tools'
const console = Console(import.meta.url)
```
