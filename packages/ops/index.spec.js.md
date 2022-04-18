# Fadroma Ops test index

This file reexports a collection of test suites for `@hackbg/runspec`.

Run them all with `pnpm -w test` at the root of the repo,
or `pnpm test SuiteName` to run an individual test suite.

```javascript
import AgentSpec   from './Agent.spec'
import BuildSpec   from './Build.spec'
import ChainSpec   from './Chain.spec'
import ClientSpec  from './Client.spec'
import CoreSpec    from './Core.spec'
import DeploySpec  from './Deploy.spec'
import DockerSpec  from './Docker.spec'
import DevnetSpec  from './Devnet.spec'
import MigrateSpec from './Migrate.spec'
import UploadSpec  from './Upload.spec'

import MocknetSpec from './wip/Mocknet.spec'

export default {
  ChainSpec,
  ClientSpec,
  CoreSpec,
  DeploySpec,
  DockerSpec,
  DevnetSpec,
  MigrateSpec,
  AgentSpec,
  UploadSpec,
  BuildSpec,

  MocknetSpec,
}
```
