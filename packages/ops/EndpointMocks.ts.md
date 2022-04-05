# `@fadroma/ops` HTTP endpoints for testing

Just enough implementation to test our own logic.

## Dockerode

This external resource is used to spawn containers
for builds and devnets.

```typescript
export function mockDockerode () {
}
```

## Builder API

```typescript
export async function mockBuilderEndpoint () {
  throw 'TODO'
}
```

## Devnet API

```typescript
export async function mockDevnetEndpoint () {
  throw 'TODO'
}
```
