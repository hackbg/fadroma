# Fadroma Build

```typescript
import { Workspace, Source, Builder, Artifact } from '.'
```

## Crates and workspaces

```typescript
let workspace: Workspace
let source:    Source
```

```typescript
console.info('specify source')
for (const source of [
  { crate: 'crate', workspace: { path: Testing.workspace, ref: 'HEAD' } },
  new Source(new Workspace(Testing.workspace, 'HEAD'), 'crate')
  new Workspace(Testing.workspace, 'HEAD').crate('crate')
]) {
  console.info('.')
  assert(source.workspace.path === Testing.workspace)
  assert(source.workspace.ref === 'HEAD')
  assert(source.crate === 'crate')
}
```
