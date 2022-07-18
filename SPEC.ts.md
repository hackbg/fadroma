# Fadroma Executable Specification

This file is a combination of spec and test suite.

* **As a specification document,** you can read it to become familiar
  with the internals of the framework and the usage of its primitives.

* **As a test suite,** you can run it with `pnpm ts:test`.
  This happens automatically in CI to prevent the most egregious regressions.

```typescript
import { Commands } from '@hackbg/komandi'
const spec    = new Command()
const subSpec = (name, ...steps) => spec.command(name, `test ${name}`, ...steps)
export default spec.entrypoint(import.meta.url)
```

## Client

```typescript
subSpec('client', () => import('./packages/client/SPEC.ts.md'))
```

## Building

```typescript
subSpec('build', () => import('./packages/build/SPEC.ts.md'))
```

## Deploying

```typescript
subSpec('deploy', () => import('./packages/deploy/SPEC.ts.md'))
```

## Devnet

```typescript
subSpec('devnet', () => import('./packages/devnet/SPEC.ts.md'))
```

## Mocknet

```typescript
subSpec('mocknet', () => import('./packages/mocknet/SPEC.ts.md'))
```

## Commands

```typescript
import * as Fadroma   from '.'
import * as Testing   from './TESTING'
import $              from '@hackbg/kabinet'
import fetch          from 'cross-fetch'
import assert         from 'assert'
import {readFileSync} from 'fs'
import { runOperation } from '.'
const { ok, equal, deepEqual, throws } = assert
let console = Fadroma.Console('Fadroma Spec')
subSpec('commands', async function testCommands () {

  // run empty operation
  await runOperation("command", "usage",
    [], [])

  // can't run operation with invalid step
  await assert.rejects(runOperation("command", "usage",
    [undefined], []))

  // run operation with one step
  assert.ok(await runOperation("command", "usage",
    [()=>({foo:true})], []))

  // catch and rethrow step failure
  const error = {}
  assert.rejects(runOperation("command", "usage",
    [()=>{throw error}], []))

  // subsequent steps update the context
  result = await runOperation("command", "usage", [
    ()=>({foo:true}),
    ()=>({bar:true})], [])

  assert.ok(result.foo)
  assert.ok(result.bar)

  // the context.run function runs steps without updating context
  await assert.rejects(runOperation("command", "usage",
    [ async (context) => { await context.run() } ], []))
  assert.ok(await runOperation("command", "usage",
    [ async (context) => { await context.run(async () => {}) } ], []))
})
```
