# Fadroma Core Specification

This is the core module of the Fadroma dApp framework.

> Run tests with `pnpm test`.
> Measure coverage with `pnpm cov`.[^1]
> Publish with `pnpm ubik`.
> [^1]: Note that stack traces output by `pnpm cov` coverage mode point to line numbers in
>       the compiled code. This is to get correct line numbers in the coverage report.
>       To get the same stack trace with correct line numbers, run `pnpm test`.

```typescript
import { CommandContext } from '@hackbg/cmds'
const context = new CommandContext()
context.command('all',
  'test everything',
  async () => {
    await context.run(['utilities'])
    await context.run(['connect'])
    await context.run(['contract'])
  })
```

This module contains the following features:

## Basic utilities

  * [Error types and event logging](./core-events.spec.ts.md)
  * [Metadata utitilites](./core-fields.spec.ts.md)

```typescript
context.command('utilities',
  'test the basic utilities',
  async () => {
    await import('./core-events.spec.ts.md')
    await import('./core-fields.spec.ts.md')
  })
```

## Connecting to chains and broadcasting transactions

  * [Chains](./core-chain.spec.ts.md)
  * [Agents](./Agent.spec.ts.md)
  * [Bundles](./core-bundle.spec.ts.md)

The innermost core of Fadroma consists of the `Chain` and `Agent`
abstract base classes. They provide a unified base layer for querying
and transacting on append-only transaction-based systems.

The platform packages (`@fadroma/scrt`, etc.) subclass those,
calling into the platform API client library (e.g. `secretjs`)
in order to implement the abstract methods.

```typescript
context.command('connect',
  'test the connection primitives',
  async () => {
    await import('./core-chain.spec.ts.md')
    await import('./Agent.spec.ts.md')
    await import('./core-bundle.spec.ts.md')
  })
```

## Describing and deploying contracts

  * [Labels](./core-upload.spec.ts.md)
  * [Code hashes](./core-upload.spec.ts.md)
  * [Clients](./core-client.spec.ts.md)
  * [Contracts](./core-contract.spec.ts.md)
  * [Deployments](./core-deploy.spec.ts.md)
  * [Builders](./core-build.spec.ts.md)
  * [Uploaders](./core-upload.spec.ts.md)

```typescript
context.command('contract',
  'test the contract ops primitives',
  async () => {
    await import('./core-contract.spec.ts.md')
    await import('./core-client.spec.ts.md')
    await import('./core-build.spec.ts.md')
    await import('./core-code.spec.ts.md')
    await import('./core-upload.spec.ts.md')
    await import('./core-labels.spec.ts.md')
  })
```

```typescript
await context.run(process.argv.slice(3))
```

## Errors

The `ClientError` class defines custom error subclasses for various error conditions.

```typescript
// Make sure each error subclass can be created with no arguments:
import { ClientError } from './core-events'
for (const subtype of [
  'Unimplemented',
  'UploadFailed',
  'InitFailed',
  'CantInit_NoName',
  'CantInit_NoAgent',
  'CantInit_NoCodeId',
  'CantInit_NoLabel',
  'CantInit_NoMessage',

  'BalanceNoAddress',
  'DeployManyFailed',
  'DifferentHashes',
  'EmptyBundle',
  'ExpectedAddress',
  'ExpectedAgent',
  'InvalidLabel',
  'InvalidMessage',
  'LinkNoAddress',
  'LinkNoCodeHash',
  'LinkNoTarget',
  'NameOutsideDevnet',
  'NoAgent',
  'NoArtifact',
  'NoArtifactURL',
  'NoBuilder',
  'NoBuilderNamed',
  'NoBundleAgent',
  'NoChain',
  'NoChainId',
  'NoCodeHash',
  'NoContext',
  'NoCrate',
  'NoCreator',
  'NoDeployment',
  'NoName',
  'NoPredicate',
  'NoSource',
  'NoTemplate',
  'NoUploader',
  'NoUploaderAgent',
  'NoUploaderNamed',
  'NoVersion',
  'NotFound',
  'NotInBundle',
  'ProvideBuilder',
  'ProvideUploader',
  'Unpopulated',
  'ValidationFailed'
]) {
  assert(new ClientError[subtype]() instanceof ClientError)
}
```

## Connect errors

```typescript
import { ConnectError } from './connect-events'
assert.ok(new ConnectError.NoChainSelected() instanceof ConnectError)
assert.ok(new ConnectError.UnknownChainSelected() instanceof ConnectError)
```

The `ClientConsole` class collects all logging output in one place.
In the future, this will enable semantic logging and/or GUI notifications.

```typescript
// Make sure each log message can be created with no arguments:
import { ClientConsole } from './core-events'
new ClientConsole().object()
new ClientConsole().object({foo:'bar',baz(){},quux:[],xyzzy:undefined,fubar:{}})
new ClientConsole().deployment()
new ClientConsole().deployment({ state: { foo: {}, bar: {} } })
new ClientConsole().receipt()
new ClientConsole().foundDeployedContract()
new ClientConsole().beforeDeploy()
new ClientConsole().afterDeploy()
new ClientConsole().deployFailed()
new ClientConsole().deployManyFailed()
new ClientConsole().deployFailedContract()
new ClientConsole().chainStatus()
new ClientConsole().warnUrlOverride()
new ClientConsole().warnIdOverride()
new ClientConsole().warnNodeNonDevnet()
new ClientConsole().warnNoAgent()
new ClientConsole().warnNoAddress()
new ClientConsole().warnNoCodeHash()
new ClientConsole().warnNoCodeHashProvided()
new ClientConsole().warnCodeHashMismatch()
new ClientConsole().confirmCodeHash()
new ClientConsole().waitingForNextBlock()
new ClientConsole().warnEmptyBundle()
new ClientConsole().chainStatus({})
new ClientConsole().chainStatus({
  chain: { constructor: { name: 1 }, mode: 2, id: 3, url: new URL('http://example.com') }
})
new ClientConsole().chainStatus({
  chain: { constructor: { name: 1 }, mode: 2, id: 3, url: new URL('http://example.com') }
  deployments: { list () { return [] } }
})
new ClientConsole().chainStatus({
  chain: { constructor: { name: 1 }, mode: 2, id: 3, url: new URL('http://example.com') }
  deployments: { list () { return [] }, active: { name: 4 } }
})
```
# Fadroma Client Fields

```typescript
import assert from 'node:assert'
```

## Alignment

For more legible output.

```typescript
import { getMaxLength } from '@fadroma/core'
assert.equal(getMaxLength(['a', 'ab', 'abcd', 'abc', 'b']), 4)
```

## Overrides and fallbacks

Only work on existing properties.

```typescript
import { override, fallback } from '@fadroma/core'
assert.deepEqual(
  override({ a: 1, b: 2 }, { b: 3, c: 4 }),
  { a: 1, b: 3 }
)
assert.deepEqual(
  fallback({ a: 1, b: undefined }, { a: undefined, b: 3, c: 4 }),
  { a: 1, b: 3 }
)
```

## Validation

Case-insensitive.

```typescript
import { validated } from '@fadroma/core'
assert.ok(validated('test', 1))
assert.ok(validated('test', 1, 1))
assert.ok(validated('test', 'a', 'A'))
assert.throws(()=>validated('test', 1, 2))
assert.throws(()=>validated('test', 'a', 'b'))
```

## Optionally/partially lazy values

```typescript
import { into, intoArray, intoRecord } from '@fadroma/core'

assert.equal(await into(1), 1)
assert.equal(await into(Promise.resolve(1)), 1)
assert.equal(await into(()=>1), 1)
assert.equal(await into(async ()=>1), 1)

assert.deepEqual(
  await intoArray([1, ()=>1, Promise.resolve(1), async () => 1]),
  [1, 1, 1, 1]
)

assert.deepEqual(await intoRecord({
  ready:   1,
  getter:  () => 2,
  promise: Promise.resolve(3),
  asyncFn: async () => 4
}), {
  ready:   1,
  getter:  2,
  promise: 3,
  asyncFn: 4
})
```
