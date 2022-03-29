import * as HTTP from 'http'
import { Transform } from 'stream'
import LineTransformStream from 'line-transform-stream'
import {
  Console, bold, resolve, relative, basename, rimraf, spawnSync, existsSync, readFileSync
} from '@hackbg/tools'
import { config } from './Config'
import { Source, Builder, Artifact, codeHashForPath } from './Core'
import { Endpoint } from './Endpoint'

const console = Console('@fadroma/ops/Build')

/** This builder talks to a remote build server over HTTP. */
export class ManagedBuilder extends Builder {
  constructor (options: { managerURL?: string } = {}) {
    super()
    const { managerURL = config.buildManager } = options
    this.manager = new Endpoint(managerURL)
  }
  /** HTTP endpoint to request builds */
  manager: Endpoint
  /** Perform a managed build. */
  async build (source): Promise<Artifact> {
    // Support optional build caching
    const prebuilt = this.prebuild(source)
    if (prebuilt) {
      return prebuilt
    }
    // Request a build from the build manager
    const { workspace, crate, ref = 'HEAD' } = source
    const { location } = await this.manager.get('/build', { crate, ref })
    const codeHash = codeHashForPath(location)
    return { location, codeHash }
  }
}

export class RawBuilder extends Builder {
  async build (source: Source): Promise<Artifact> {
    throw new Error('pls update this code (to use e.g. Scrt_1_2_Build.sh?)')
    const { ref = 'HEAD', workspace, crate } = source
    if (ref && ref !== 'HEAD') {
      throw new Error('[@fadroma/ops/Contract] non-HEAD builds unsupported outside Docker')
    }
    const run = (cmd: string, ...args: string[]) =>
      spawnSync(cmd, args, { cwd: workspace, stdio: 'inherit', env: {
        RUSTFLAGS:   '-C link-arg=-s',
        Output:      'TODO',
        FinalOutput: 'TODO',
      } })
    run('cargo',
        'build', '-p', crate,
        '--target', 'wasm32-unknown-unknown',
        '--release',
        '--locked',
        '--verbose')
    run('wasm-opt',
        '-Oz', './target/wasm32-unknown-unknown/release/$Output.wasm',
        '-o', '/output/$FinalOutput')
    run('sh', '-c',
        "sha256sum -b $FinalOutput > $FinalOutput.sha256")
    return { location: 'TODO' }
  }
}
