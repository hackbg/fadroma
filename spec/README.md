---
literate: typescript
---

# Fadroma Executable Specification

The contents of this directory serve as the specification and
test suite for the Fadroma distributed application framework.

This file is simultaneously the entry point for a reader
intending to familiarize oneself with the framework, and
for the test runner which ensures feature parity across
the underlying platforms.

See the [Harness](./_Harness.ts.md) file to learn more about
the additional utilites helpers that help tie the test suite together.

The tests are defined in TypeScript or JavaScript embedded in
Markdown using the `@hackbg/ganesha` literate programming library,
and are executed using a simple test runner called `@hackbg/runspec`.

The `default` export of each test module contains the
test cases defined by that file.

Run them all with `pnpm -w test` at the root of the repo,
or `pnpm test SuiteName` to run an individual test suite.

Due to the current difficulty of integrating type checking with
literate programming, the actual implementation of Fadroma is
implemented in regular TypeScript.

```javascript
import Agent   from './Agent.spec'
import Build   from './Build.spec'
import Chain   from './Chain.spec'
import Client  from './Client.spec'
import Deploy  from './Deploy.spec'
import Devnet  from './Devnet.spec'
import Operate from './Operate.spec'
import Mocknet from './Mocknet.spec'
import Upload  from './Upload.spec'

const Specification = {
  Agent,
  Build,
  Chain,
  Client,
  Deploy,
  Devnet,
  Operate,
  Mocknet,
  Upload,
}

export default Specification
```
