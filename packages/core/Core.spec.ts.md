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
