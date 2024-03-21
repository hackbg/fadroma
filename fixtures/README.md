# Fixtures

* Files with a fixed content that are used in the test suites.
* TODO use `fetch` instead of Node FS API

## Example mnemonics

## Example contracts

* **Echo contract** (build with `pnpm rs:build:example examples/echo`).
  Parrots back the data sent by the client, in order to validate
  reading/writing and serializing/deserializing the input/output messages.
* **KV contract** (build with `pnpm rs:build:example examples/kv`).
  Exposes the key/value storage API available to contracts,
  in order to validate reading/writing and serializing/deserializing stored values.

## Mocks

### Mock agent
