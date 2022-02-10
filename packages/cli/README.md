# Fadroma CLI

## Running commands in a project

> See [`@hackbg/komandi`](https://github.com/hackbg/toolbox),

**`Fadroma.command(command: string, ...stages: Function[])`**
defines a command as a match between:

* some **words** (represented by a space-separated string); and
* some **stages** (represented by async functions taking a single object argument)

```typescript
// do.ts
import Fadroma from '@hackbg/fadroma'
Fadroma.command('do something cat',
  Cat.init,
  async function meow ({
    agent }) {
    // go wild here
  })
```

### The `MigrationContext`

When invoking the command, the steps are executed
in sequence, with a common state object -
the [`MigrationContext`](https://github.com/hackbg/fadroma/blob/22.01/packages/ops/index.ts).

This contains handles to the entities that Fadroma provides
for scripting smart contracts. It is up to you to define
suitable command content depending on your business logic.

The `MigrationContext` can be modified by individual **stages**,
by returning an object value from the stage;. The keys of the
object are then added into the context for subsequent steps.

> See [`Deployments.activate`](#needsdeployment)
