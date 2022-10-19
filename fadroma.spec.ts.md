# Fadroma Executable Specification

This file is a combination of spec and test suite.

* **As a specification document,** you can read it to become familiar
  with the internals of the framework and the usage of its primitives.

* **As a test suite,** you can run it with `pnpm ts:test`.
  This happens automatically in CI to prevent the most egregious regressions.

```typescript
const spec    = { Spec: {} }
const subSpec = (name, step) => spec.Spec[name] = step
export default spec
```

## [Core client model](./packages/client/client.spec.ts.md)

```typescript
subSpec('Client', () => import('./packages/client/client.spec.ts.md').then(console.log))
```

## [Tokens](./packages/tokens/tokens.spec.ts.md)

```typescript
subSpec('Tokens', () => import('./packages/tokens/tokens.spec.ts.md').then(console.log))
```

## [Connecting to chains](./packages/connect/connect.spec.ts.md')

```typescript
subSpec('Connect', () => import('./packages/connect/connect.spec.ts.md').then(console.log))
```

## [Building contracts](./packages/build/build.spec.ts.md)

```typescript
subSpec('Build', () => import('./packages/build/build.spec.ts.md').then(console.log))
```

## [Deploying contracts](./packages/deploy/deploy.spec.ts.md)

```typescript
subSpec('Deploy', () => import('./packages/deploy/deploy.spec.ts.md').then(console.log))
```

## [Devnet](./packages/devnet/devnet.spec.ts.md)

```typescript
subSpec('Devnet', () => import('./packages/devnet/devnet.spec.ts.md').then(console.log))
```

## [Mocknet](./packages/mocknet/mocknet.spec.ts.md)

```typescript
subSpec('Mocknet', () => import('./packages/mocknet/mocknet.spec.ts.md').then(console.log))
```
