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

## Client

```typescript
subSpec('Client', () => import('./packages/client/SPEC.ts.md').then(console.log))
```

## Building

```typescript
subSpec('Build', () => import('./packages/build/SPEC.ts.md').then(console.log))
```

## Deploying

```typescript
subSpec('Deploy', () => import('./packages/deploy/SPEC.ts.md').then(console.log))
```

## Devnet

```typescript
subSpec('Devnet', () => import('./packages/devnet/SPEC.ts.md').then(console.log))
```

## Mocknet

```typescript
subSpec('Mocknet', () => import('./packages/mocknet/SPEC.ts.md').then(console.log))
```
