# Feature roadmap

```typescript
import assert from 'assert'
```

## Deliverability

* **WIP:** Publish JS packages to NPM

```typescript
// TODO test that there are npm urls corresponding to the repo contents...
```

* Publish Rust crates to Cargo

```typescript
// TODO test that there are cargo urls corresponding to the repo contents...
```

* Deliver through `npx fadroma`

```typescript
// TODO test project setup here...
```

* Deliver as shell with global `fadroma` command by calling `nix-shell https://fadroma.tech/nix`

```typescript
// TODO test download link here...
```

* Deliver as monolithic binary with semantic GUI (DOM or other)

```typescript
// TODO test download link here...
```

## Portability

* Be able to run a deploy procedure in a browser

```typescript
// optional, run with command argument: TODO test in containerized browser here...
```

* Support for seamlessly building code from remote URLs (e.g. Git)

```typescript
// TODO test here...
```

* Support for remote builders and devnets

```typescript
import { ManagedDevnet } from '../index'
import { mockDevnetManager } from './_Harness'
for (const version of ['1.2', '1.3']) {
  const manager = await mockDevnetManager()
  try {
    const devnet = getScrtDevnet(version, manager.url)
    ok(devnet instanceof ManagedDevnet)
    await devnet.respawn()
    console.info('Respawned')
    await devnet.save()
  } catch (e) {
    console.warn(e) // TODO use whole devnet manager with mocked devnet init
  } finally {
    manager.close()
  }
}
```

## Usability

* Fadroma Starter Pack

```typescript
assert.ok(await fetch("https://github.com/hackbg/fadroma-example"))
```

* Fadroma Web Dashboard
  * Show list of deployment and contracts in selected deployment
  * Render generated and written documentation from project and dependencies
  * Allow deployments and operations to be run from the browser
  * Render source of smart contracts but don't allow editing for now
  * Embedded instance of official transaction explorer
  * `secretcli q tx` and `secretcli q compute tx` in the same view
  * Platform and connection selector
  * Drop compiled contract blobs into GUI and have them expose their methods.
    Pass them each other's addresses to test inter-contract communication in a sandbox.
  * Drag and drop multisig transaction signer
    * Support system keystore in the same way as `secretcli` does
      to securely sign transactions with the user's mainnet/testnet private keys

```typescript
// TODO run test suite of dashboard module here...
```

* Fadroma Test Track
  * View and publish rich test and coverage reports, allow tests to be re-ran/edited from GUI
  * Render interaction diagrams from logs of test runs to display inter-contract communication
  * Use profiling-instrumented builds in JS-based integration tests to get full-stack coverage
  * Gas profiling - calculate cost of each opcode without having to wait for block timings. Compile a crypto-less `cosmwasm-vm` if necessary.
  * See if literate programming can be extended to `cargo doc`/`rustc`...
    * separate doc comments from attribute macros in the parser?
  * Time travel: rewind/force next block
  * Spawn terminals with different secretcli configs for hammer tuning

```typescript
// TODO run test suite of dashboard module here...
```
