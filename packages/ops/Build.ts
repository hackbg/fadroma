import {
  rimraf, Docker, spawnSync, resolve, relative, existsSync, ensureDockerImage,
  Console, bold, tmp
} from '@hackbg/tools'

const console = Console('@fadroma/ops/build')

export type ContractBuildOptions = {
  workspace?:     string
  crate?:         string
  repo?:          string
  ref?:           string
  artifact?:      string
  codeHash?:      string
}

export interface ContractBuild extends ContractBuildOptions {
  buildInDocker (socket?: string): Promise<any>
  buildRaw      ():                Promise<any>
}

export abstract class DockerizedContractBuild implements ContractBuild {

  constructor (options: ContractBuildOptions = {}) {
    for (const key of Object.keys(options)) {
      this[key] = options[key]
    }
  }

  // build environment
  abstract buildImage:      string|null
  abstract buildDockerfile: string|null
  abstract buildScript:     string|null

  // build inputs
  repo?:      string
  ref?:       string
  workspace?: string
  crate?:     string

  // build outputs
  artifact?: string
  codeHash?: string

  /** Build the contract in the default dockerized build environment for its chain.
    * Need access to Docker daemon. */
  async buildInDocker (socketPath = '/var/run/docker.sock'): Promise<string> {
    this.artifact = await buildInDocker(new Docker({ socketPath }), this)
    return this.artifact
  }

  /** Build the contract outside Docker.
    * Assume a standard toolchain is present in the script's environment. */
  async buildRaw (): Promise<string> {

    if (this.ref && this.ref !== 'HEAD') {
      throw new Error('[@fadroma/ops/Contract] non-HEAD builds unsupported outside Docker')
    }

    const run = (cmd: string, ...args: string[]) =>
      spawnSync(cmd, args, {
        cwd:   this.workspace,
        stdio: 'inherit',
        env:   { RUSTFLAGS: '-C link-arg=-s' }
      })

    run('cargo',
        'build', '-p', this.crate,
        '--target', 'wasm32-unknown-unknown',
        '--release',
        '--locked',
        '--verbose')

    run('wasm-opt',
        '-Oz', './target/wasm32-unknown-unknown/release/$Output.wasm',
        '-o', '/output/$FinalOutput')

    run('sh', '-c',
        "sha256sum -b $FinalOutput > $FinalOutput.sha256")

    return this.artifact

  }

}
/** Compile a contract from source */
// TODO support clone & build contract from external repo+ref
export async function buildInDocker (
  docker:       Docker,
  buildOptions: DockerizedContractBuild
) {

  const {
    crate,
    ref = 'HEAD',
    buildScript,
    buildDockerfile
  } = buildOptions

  let {
    workspace,
    buildImage
  } = buildOptions

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
        'CARGO_HTTP_TIMEOUT=240'
      ]
    }

    console.debug(
      `Running ${bold(buildCommand)} in ${bold(buildImage)} with the following options:`,
      buildArgs
    )

    const [{ Error:err, StatusCode:code }, container] = await docker.run(
      buildImage,
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
