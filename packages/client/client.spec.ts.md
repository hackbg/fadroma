# Fadroma Core Specification

This is the core module of the Fadroma dApp framework.

> Run tests with `pnpm test`.
> Measure coverage with `pnpm cov`.[^1]
> Publish with `pnpm ubik`.
> [^1]: Note that stack traces output by `pnpm cov` coverage mode point to line numbers in
>       the compiled code. This is to get correct line numbers in the coverage report.
>       To get the same stack trace with correct line numbers, run `pnpm test`.

This module contains the following features:

## [Connecting to chains and broadcasting transactions](./client-connect.spec.ts.md)

```typescript
import './client-connect.spec.ts.md'
```

## [Describing contracts](./client-contract.spec.ts.md)

```typescript
import './client-contract.spec.ts.md'
```

## [Deploying contracts](./client-deploy.spec.ts.md)

```typescript
import './client-deploy.spec.ts.md'
```

## [Error types and event logging](./client-events.spec.ts.md)

```typescript
import './client-events.spec.ts.md'
```

## [Lazy and composable value objects, runtime validation](./client-fields.spec.ts.md)

```typescript
import './client-fields.spec.ts.md'
```
