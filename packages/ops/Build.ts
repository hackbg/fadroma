import { Console, bold } from '@hackbg/tools'

const console = Console('@fadroma/ops/Build')

/** Take a workspace and a list of crates in it and return a function
  * that creates a mapping from crate name to Source object for a particular VCS ref. */
export const collectCrates = (workspace: string, crates: string[]) =>
  (ref?: string): Record<string, Source> =>
    crates.reduce(
      (sources, crate)=>Object.assign(sources, {[crate]: new Source(workspace, crate, ref)}),
      {}
    )

import { resolve, relative, rimraf, spawnSync, existsSync, readFileSync } from '@hackbg/tools'

import { Source, Builder, Artifact } from './Core'
export abstract class BaseBuilder implements Builder {
  abstract build (source: Source): Promise<Artifact>
}

export abstract class DockerBuilder extends BaseBuilder {
  abstract buildImage:      string
  abstract buildDockerfile: string
  abstract buildScript:     string
  build = buildInDocker
}

import { tmp, Docker, ensureDockerImage } from '@hackbg/tools'
import { codeHashForPath } from './Core'
export async function buildInDocker (
  source: Source,
  context = this /* is magic */
): Promise<Artifact> {

  let {
    workspace,
    crate,
    ref = 'HEAD'
  } = source

  if (!workspace) {
    throw new Error(`[@fadroma/ops] Missing workspace path (crate ${crate} at ${ref})`)
  }

  let {
    buildImage,
    buildDockerfile,
    buildScript,
    socketPath = '/var/run/docker.sock',
    docker     = new Docker({ socketPath })
  } = context

  const outputDir = resolve(workspace, 'artifacts')

  const location  = resolve(outputDir, `${crate}@${ref}.wasm`)

  if (existsSync(location)) {
    console.info('✅', bold(location), 'exists, not rebuilding.')
    return { location, codeHash: codeHashForPath(location) }
  }

  const run = (cmd: string, ...args: string[]) =>
    spawnSync(cmd, args, { cwd: workspace, stdio: 'inherit' })

  let tmpDir

  try {

    if (!ref || ref === 'HEAD') {
      // Build working tree
      console.info(
        `Building crate ${bold(crate)} ` +
        `from working tree at ${bold(workspace)} ` +
        `into ${bold(outputDir)}...`
      )
    } else {
      // Copy working tree into /tmp and checkout the commit to build
      console.info(
        `Building crate ${bold(crate)} ` +
        `from commit ${bold(ref)} ` +
        `into ${bold(outputDir)}...`
      )
      tmpDir = tmp.dirSync({ prefix: 'fadroma_build', tmpdir: '/tmp' })
      console.info(
        `Copying source code from ${bold(workspace)} ` +
        `into ${bold(tmpDir.name)}`
      )
      run('cp', '-rT', workspace, tmpDir.name)
      workspace = tmpDir.name
      console.info(`Cleaning untracked files from ${bold(workspace)}...`)
      run('git', 'stash', '-u')
      run('git', 'reset', '--hard', '--recurse-submodules')
      run('git', 'clean', '-f', '-d', '-x')
      console.info(`Checking out ${bold(ref)} in ${bold(workspace)}...`)
      run('git', 'checkout', ref)
      console.info(`Preparing submodules...`)
      run('git', 'submodule', 'update', '--init', '--recursive')
    }
    run('git', 'log', '-1')
    buildImage = await ensureDockerImage(buildImage, buildDockerfile, docker)
    const buildCommand = `bash /entrypoint.sh ${crate} ${ref}`
    const buildArgs = {
      Tty:         true,
      AttachStdin: true,
      Entrypoint:  ['/bin/sh', '-c'],
      HostConfig:  {
        Binds: [
          // Input
          `${workspace}:/contract:rw`,

          // Build command
          ...(buildScript ? [`${buildScript}:/entrypoint.sh:ro`] : []),

          // Output
          `${outputDir}:/output:rw`,

          // Caches
          `project_cache_${ref}:/code/target:rw`,
          `cargo_cache_${ref}:/usr/local/cargo:rw`,
        ]
      },
      Env: [
        'CARGO_NET_GIT_FETCH_WITH_CLI=true',
        'CARGO_TERM_VERBOSE=true',
        'CARGO_HTTP_TIMEOUT=240',
        'LOCKED=',//'--locked'
      ]
    }

    console.debug(
      `Running ${bold(buildCommand)} in ${bold(buildImage)} with the following options:`,
      buildArgs
    )

    const [{ Error:err, StatusCode:code }, container] = await docker.run(
      buildImage, buildCommand, process.stdout, buildArgs
    )

    await container.remove()

    if (err) {
      throw new Error(`[@fadroma/ops/Build] Docker error: ${err}`)
    }

    if (code !== 0) {
      console.error(bold('Build of'), crate, 'exited with', bold(code))
      throw new Error(`[@fadroma/ops/Build] Build of ${crate} exited with status ${code}`)
    }

    return { location, codeHash: codeHashForPath(location) }

  } finally {
    if (tmpDir) rimraf(tmpDir.name)
  }

}

export abstract class RawBuilder extends BaseBuilder {
  build = buildRaw
}

export async function buildRaw (source: Source, context = this): Promise<Artifact> {
  throw new Error('pls review')
  const { ref = 'HEAD', workspace, crate } = source
  if (ref && ref !== 'HEAD') {
    throw new Error('[@fadroma/ops/Contract] non-HEAD builds unsupported outside Docker')
  }
  const run = (cmd: string, ...args: string[]) =>
    spawnSync(cmd, args, { cwd: workspace, stdio: 'inherit', env: {
      RUSTFLAGS: '-C link-arg=-s'
      Output,
      FinalOutput
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
  return { location }
}
