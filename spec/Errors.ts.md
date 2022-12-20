```typescript
import assert from 'node:assert'
```

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
