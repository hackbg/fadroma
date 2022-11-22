import { LocalBuilder, artifactName, sanitize } from './build-base'
import { BuildConsole } from './build-events'
import { getGitDir } from './build-history'
import { Contract, HEAD } from '@fadroma/core'
import type { Buildable, Built } from '@fadroma/core'
import $ from '@hackbg/file'
import { bold } from '@hackbg/logs'
import { spawn } from 'node:child_process'
import { pathToFileURL } from 'node:url'

/** This build mode looks for a Rust toolchain in the same environment
  * as the one in which the script is running, i.e. no build container. */
export class RawBuilder extends LocalBuilder {

  readonly id = 'raw-local'

  log = new BuildConsole('Fadroma.RawBuilder')

  runtime = process.argv[0]

  /** Build a Source into a Template */
  async build (source: Buildable): Promise<Built> {
    const { workspace, revision = HEAD, crate } = source
    if (!workspace) throw new Error('no workspace')
    if (!crate)     throw new Error('no crate')

    // Temporary dirs used for checkouts of non-HEAD builds
    let tmpGit, tmpBuild

    // Most of the parameters are passed to the build script
    // by way of environment variables.
    const env = {
      _BUILD_GID: process.getgid(),
      _BUILD_UID: process.getuid(),
      _OUTPUT:    $(workspace).in('artifacts').path,
      _REGISTRY:  '',
      _TOOLCHAIN: this.toolchain,
    }

    if ((revision ?? HEAD) !== HEAD) {
      const gitDir = this.getGitDir(source)
      // Provide the build script with the config values that ar
      // needed to make a temporary checkout of another commit
      if (!gitDir?.present) {
        const error = new Error("Fadroma Build: could not find Git directory for source.")
        throw Object.assign(error, { source })
      }
      // Create a temporary Git directory. The build script will copy the Git history
      // and modify the refs in order to be able to do a fresh checkout with submodules
      tmpGit   = $.tmpDir('fadroma-git-')
      tmpBuild = $.tmpDir('fadroma-build-')
      Object.assign(env, {
        _GIT_ROOT:   gitDir.path,
        _GIT_SUBDIR: gitDir.isSubmodule ? gitDir.submoduleDir : '',
        _NO_FETCH:   this.noFetch,
        _TMP_BUILD:  tmpBuild.path,
        _TMP_GIT:    tmpGit.path,
      })
    }

    // Run the build script
    const cmd  = this.runtime!
    const args = [this.script!, 'phase1', revision, crate ]
    const opts = { cwd: source.workspace, env: { ...process.env, ...env }, stdio: 'inherit' }
    const sub  = this.spawn(cmd, args, opts as any)
    await new Promise<void>((resolve, reject)=>{
      sub.on('exit', (code: number, signal: any) => {
        const build = `Build of ${source.crate} from ${$(source.workspace!).shortPath} @ ${source.revision}`
        if (code === 0) {
          resolve()
        } else if (code !== null) {
          const message = `${build} exited with code ${code}`
          this.log.error(message)
          throw Object.assign(new Error(message), { source, code })
        } else if (signal !== null) {
          const message = `${build} exited by signal ${signal}`
          this.log.warn(message)
        } else {
          throw new Error('Unreachable')
        }
      })
    })

    // If this was a non-HEAD build, remove the temporary Git dir used to do the checkout
    if (tmpGit   && tmpGit.exists())   tmpGit.delete()
    if (tmpBuild && tmpBuild.exists()) tmpBuild.delete()

    // Create an artifact for the build result
    const location = $(env._OUTPUT, artifactName(crate, sanitize(revision)))
    this.log.info('Build ok:', bold(location.shortPath))
    return Object.assign(source, {
      artifact: pathToFileURL(location.path),
      codeHash: this.hashPath(location.path)
    })
  }

  /** This implementation groups the passed source by workspace and ref,
    * in order to launch one build container per workspace/ref combination
    * and have it build all the crates from that combination in sequence,
    * reusing the container's internal intermediate build cache. */
  async buildMany (inputs: Buildable[]): Promise<Built[]> {
    const templates: Built[] = []
    for (const source of inputs) templates.push(await this.build(source))
    return templates
  }

  protected spawn (...args: Parameters<typeof spawn>) {
    return spawn(...args)
  }

  protected getGitDir (...args: Parameters<typeof getGitDir>) {
    return getGitDir(...args)
  }

}
