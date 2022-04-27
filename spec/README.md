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

The tests are defined in TypeScript or JavaScript embedded in
Markdown using the `@hackbg/ganesha` literate programming library,
and are executed using a simple test runner called `@hackbg/runspec`.

Run them all with `pnpm -w test` at the root of the repo,
or `pnpm test SuiteName` to run an individual test suite.

Due to the current difficulty of integrating type checking with
literate programming, the actual implementation of Fadroma is
implemented in regular TypeScript.

```javascript
import AgentSpec   from './Agent.spec'
import BuildSpec   from './Build.spec'
import ChainSpec   from './Chain.spec'
import ClientSpec  from './Client.spec'
import CoreSpec    from './Core.spec'
import DeploySpec  from './Deploy.spec'
import DevnetSpec  from './Devnet.spec'
import DockerSpec  from './Docker.spec'
import MigrateSpec from './Migrate.spec'
import MocknetSpec from './Mocknet.spec'
import UploadSpec  from './Upload.spec'

const Specification = {
  AgentSpec,
  BuildSpec,
  ChainSpec,
  ClientSpec,
  CoreSpec,
  DeploySpec,
  DevnetSpec,
  DockerSpec,
  MigrateSpec,
  MocknetSpec,
  UploadSpec,
}

export default Specification
```
