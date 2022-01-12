import type { ContractCodeOptions } from './Model'
import {
  Console, bold,
  resolve, relative, existsSync,
  homedir, tmp, copy,
  Docker, ensureDockerImage,
  rimraf, spawnSync
} from '@fadroma/tools'

const console = Console(import.meta.url)

export abstract class ContractCode {

  abstract buildImage:      string|null
  abstract buildDockerfile: string|null
  abstract buildScript:     string|null

  code: ContractCodeOptions = {}

  constructor (options: ContractCodeOptions = {}) {
    if (options.ref)       this.code.ref       = options.ref
    if (options.workspace) this.code.workspace = options.workspace
    if (options.crate)     this.code.crate     = options.crate
    if (options.artifact)  this.code.artifact  = options.artifact
    if (options.codeHash)  this.code.codeHash  = options.codeHash
  }

  /** Path to source workspace */
  get workspace () { return this.code.workspace }

  /** Name of source crate within workspace */
  get crate     () { return this.code.crate }

  /** Name of compiled binary */
  get artifact  () { return this.code.artifact }

  /** SHA256 hash of the uncompressed artifact */
  get codeHash  () { return this.code.codeHash }

  private docker = new Docker({ socketPath: '/var/run/docker.sock' })

  /** Compile a contract from source */
  // TODO support clone & build contract from external repo+ref
  async build ({
    workspace = this.workspace,
    crate     = this.crate,
    ref       = 'HEAD'
  } = this.code) {

    let tmpDir

    try {

      const outputDir = resolve(this.workspace, 'artifacts')
      const artifact  = resolve(outputDir, `${this.crate}@${ref}.wasm`)

      if (existsSync(artifact)) {

        console.info(`${bold(relative(process.cwd(), artifact))} exists, delete to rebuild`)

      } else {

        if (ref === 'HEAD') {

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

          await new Promise<void>((resolve, reject)=>copy(
            workspace,
            tmpDir.name,
            { dot: true },
            (error, results)=>error ? reject(error) : resolve()))

          workspace = tmpDir.name

          console.info(`Cleaning untracked files from ${bold(workspace)}...`)
          spawnSync('git', ['reset', '--hard'], { cwd: workspace, stdio: 'inherit' })
          spawnSync('git', ['clean', '-f', '-d', '-x'], { cwd: workspace, stdio: 'inherit' })

          console.info(`Checking out ${bold(ref)} in ${bold(workspace)}...`)
          spawnSync('git', ['checkout', ref], { cwd: workspace, stdio: 'inherit' })

          console.info(`Preparing submodules...`)
          spawnSync('git', ['submodule', 'update', '--init', '--recursive'], { cwd: workspace, stdio: 'inherit' })

        }

        spawnSync('git', ['log', '-1'], { cwd: workspace, stdio: 'inherit' })

        const buildImage   = await ensureDockerImage(this.buildImage, this.buildDockerfile, this.docker)
        const buildCommand = `bash /entrypoint.sh ${this.crate} ${ref}`
        const buildArgs    = {

          Tty:         true,

          AttachStdin: true,

          Entrypoint:  ['/bin/sh', '-c'],

          HostConfig:  {
            Binds: [
              // Input
              `${workspace}:/contract:rw`,

              // Build command
              ...(this.buildScript ? [`${this.buildScript}:/entrypoint.sh:ro`] : []),

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

        const [{ Error:err, StatusCode:code }, container] = await this.docker.run(
          buildImage, buildCommand, process.stdout, buildArgs
        )

        await container.remove()
        if (err) throw err
        if (code !== 0) throw new Error(`build of ${this.crate} exited with status ${code}`)

      }

      return this.code.artifact = artifact

    } finally {

      if (tmpDir) rimraf(tmpDir.name)

    }

  }

}
