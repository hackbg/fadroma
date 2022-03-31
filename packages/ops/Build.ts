import * as HTTP from 'http'
import { Transform } from 'stream'
import LineTransformStream from 'line-transform-stream'
import {
  Console, bold, resolve, relative, basename, rimraf,
  spawnSync, execFile, existsSync, readFileSync
} from '@hackbg/tools'
import { config } from './Config'
import { Source, Builder, Artifact, codeHashForPath } from './Core'
import { Endpoint } from './Endpoint'

const console = Console('@fadroma/ops/Build')

/** This build mode uses the toolchain from the developer's environment. */
export class RawBuilder extends Builder {

  constructor (
    public readonly buildScript:    string,
    public readonly checkoutScript: string
  ) { super() }

  async build (source: Source): Promise<Artifact> {

    const { ref = 'HEAD', workspace, crate } = source

    let cwd = workspace

    // LD_LIBRARY_PATH=$(nix-build -E 'import <nixpkgs>' -A 'gcc.cc.lib')/lib64

    const run = (cmd, args) => new Promise((resolve, reject)=>{
      const env = { ...process.env, CRATE: crate, REF: ref, WORKSPACE: workspace }
      execFile(cmd, args, { cwd, env, stdio: 'inherit' } as any, (error, stdout, stderr) => {
        if (error) return reject(error)
        resolve([stdout, stderr])
      })
    })

    if (ref && ref !== 'HEAD') {
      await run(this.checkoutScript, [])
    }

    await run(this.buildScript, [])

    const location = resolve(workspace, 'artifacts', `${crate}@${ref.replace(/\//g,'_')}.wasm`)

    const codeHash = codeHashForPath(location)

    return { location, codeHash }

  }

}

/** This builder talks to a remote build server over HTTP. */
export class ManagedBuilder extends Builder {

  Endpoint = Endpoint

  constructor (options: { managerURL?: string } = {}) {
    super()
    const { managerURL = config.buildManager } = options
    this.manager = new this.Endpoint(managerURL)
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
