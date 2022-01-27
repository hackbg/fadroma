import {
  rimraf, Docker, spawnSync, resolve, relative, existsSync, ensureDockerImage,
  Console, bold, tmp
} from '@hackbg/tools'

const console = Console('@fadroma/ops/Build')

export type BuildEnv = {
  image?:      string
  dockerfile?: string
  script?:     string
}

export type BuildInputs = {
  workspace?: string
  crate?:     string
  repo?:      string
  ref?:       string
}

export type BuildOutputs = {
  artifact?: string
  codeHash?: string
}

export type BuildInfo = BuildEnv & BuildInputs & BuildOutputs

export interface Build extends BuildInfo {
  (options?: { socketPath }): Promise<string>
}

export interface Buildable extends BuildInfo {
  build (options?: { socketPath }): Promise<string>
}

export type BuildMode = 'raw'|'docker'

export class Builder implements Buildable {

  constructor (contract: Buildable) {
    this.#contract = contract
  }

  /** Data actually lives here */
  #contract: Buildable

  /** Except the build internals */
  mode:       BuildMode = 'docker'
  image:      string
  dockerfile: string
  script:     string

  get repo      () { return this.#contract.repo      }
  get ref       () { return this.#contract.ref       }
  get workspace () { return this.#contract.workspace }
  get crate     () { return this.#contract.crate     }
  get artifact  () { return this.#contract.artifact  }
  get codeHash  () { return this.#contract.codeHash  }

  async build ({ socketPath = '/var/run/docker.sock' } = {}) {
    if (this.mode === 'docker') {
      this.#contract.artifact = await buildInDocker(new Docker({ socketPath }), this)
    } else if (this.mode === 'raw') {
      this.#contract.artifact = await buildRaw(this)
    } else {
      throw new Error
    }
    return this.artifact
  }

}

/** Build the contract outside Docker.
  * Assume a standard toolchain is present in the script's enviVronment. */
async function buildRaw ({
  ref,
  workspace,
  crate,
  artifact
}: Buildable): Promise<string> {
  if (ref && ref !== 'HEAD') {
    throw new Error('[@fadroma/ops/Contract] non-HEAD builds unsupported outside Docker')
  }
  const run = (cmd: string, ...args: string[]) =>
    spawnSync(cmd, args, {
      cwd:   workspace,
      stdio: 'inherit',
      env:   { RUSTFLAGS: '-C link-arg=-s' }
    })
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
  return artifact
}

/** Build the contract in the default dockerized build environment for its chain.
  * Need access to Docker daemon. */
export async function buildInDocker (docker: Docker, {
  image, dockerfile, script,
  workspace, crate, ref = 'HEAD',
}: Buildable): Promise<string> {
  if (!workspace) {
    throw new Error(`[@fadroma/ops] Missing workspace path (crate ${crate} at ${ref})`)
  }
  const run = (cmd: string, ...args: string[]) =>
    spawnSync(cmd, args, { cwd: workspace, stdio: 'inherit' })
  let tmpDir
  try {
    const outputDir = resolve(workspace, 'artifacts')
    const artifact  = resolve(outputDir, `${crate}@${ref}.wasm`)
    if (existsSync(artifact)) {
      console.info(bold(`Not rebuilding:`), relative(process.cwd(), artifact))
      return artifact
    }
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
    image = await ensureDockerImage(image, dockerfile, docker)
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
          ...(script ? [`${script}:/entrypoint.sh:ro`] : []),

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
        'CARGO_HTTP_TIMEOUT=240'
      ]
    }
    console.debug(
      `Running ${bold(buildCommand)} in ${bold(image)} with the following options:`,
      buildArgs
    )
    const [{ Error:err, StatusCode:code }, container] = await docker.run(
      image,
      buildCommand,
      process.stdout,
      buildArgs
    )
    await container.remove()
    if (err) throw err
    if (code !== 0) throw new Error(`[@fadroma/ops] Build of ${crate} exited with status ${code}`)
    return artifact
  } finally {
    if (tmpDir) rimraf(tmpDir.name)
  }
}
