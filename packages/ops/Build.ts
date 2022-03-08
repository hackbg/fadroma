import * as HTTP from 'http'
import { Console, bold } from '@hackbg/tools'
import { resolve, relative, rimraf, spawnSync, existsSync, readFileSync } from '@hackbg/tools'
import { Source, Builder, Artifact, codeHashForPath } from './Core'
import { tmp, Docker, ensureDockerImage } from '@hackbg/tools'
import { Endpoint } from './Endpoint'

const console = Console('@fadroma/ops/Build')

/** Take a workspace and a list of crates in it and return a function
  * that creates a mapping from crate name to Source object for a particular VCS ref. */
export const collectCrates = (workspace: string, crates: string[]) =>
  (ref?: string): Record<string, Source> =>
    crates.reduce(
      (sources, crate)=>Object.assign(sources, {[crate]: new Source(workspace, crate, ref)}),
      {}
    )

/** This builder talks to a remote build server over HTTP. */
export abstract class ManagedBuilder extends Builder {
  manager: Endpoint
  constructor (options: { managerURL?: string } = {}) {
    super()
    const { managerURL = process.env.FADROMA_BUILD_MANAGER } = options
    this.manager = new Endpoint(managerURL)
  }
  async build (source): Promise<Artifact> {
    // Support optional build caching
    const prebuilt = this.prebuild(source)
    if (prebuilt) {
      return prebuilt
    }
    const { workspace, crate, ref = 'HEAD' } = source
    const { location } = await this.manager.get('/build', { crate, ref })
    const codeHash = codeHashForPath(location)
    return { location, codeHash }
  }
}

/** This builder launches a one-off build container using Dockerode.
  * Subclasses need to define the build image and script to run,
  * as well as a Dockerfile to build the build image. */
export abstract class DockerodeBuilder extends Builder {
  abstract buildImage:      string
  abstract buildDockerfile: string
  abstract buildScript:     string
  /** Used to launch build container. */
  socketPath: string = '/var/run/docker.sock'
  /** Used to launch build container. */
  docker:     Docker = new Docker({ socketPath: this.socketPath })
  /** Set the first time this Builder instance is used to build something. */
  private ensuringBuildImage: Promise<string>|null = null
  /** If `ensuringBuildImage` is not set, sets it to a Promise that resolves
    * when the build image is available. Returns that Promise every time. */
  private get buildImageReady () {
    if (!this.ensuringBuildImage) {
      console.info(bold('Ensuring build image:'), this.buildImage, 'from', this.buildDockerfile)
      return this.ensuringBuildImage = ensureDockerImage(this.buildImage, this.buildDockerfile, this.docker)
    } else {
      console.info(bold('Already ensuring build image from parallel build:'), this.buildImage)
      return this.ensuringBuildImage
    }
  }
  async build (source) {
    // Support optional build caching
    const prebuilt = this.prebuild(source)
    if (prebuilt) {
      return prebuilt
    }
    const { workspace, crate, ref = 'HEAD' } = source
    const outputDir = resolve(workspace, 'artifacts')
    const location  = resolve(outputDir, `${crate}@${ref}.wasm`)
    // Wait until the build image is available.
    const image = await this.buildImageReady
    // Configuration of the build container
    const cmd = `bash /entrypoint.sh ${crate} ${ref}`
    const args = getBuildContainerArgs(workspace, ref, outputDir, this.buildScript)
    // Run the build in the container
    console.debug(
      `Running ${bold(cmd)} in ${bold(image)}`,
      `with the following options:`, args
    )
    const running = await this.docker.run(image, cmd, process.stdout, args)
    const [{ Error:err, StatusCode:code }, container] = running
    // Remove the container once it's exited
    await container.remove()
    // Throw error if build failed
    if (err) {
      throw new Error(`[@fadroma/ops/Build] Docker error: ${err}`)
    }
    if (code !== 0) {
      console.error(bold('Build of'), crate, 'exited with', bold(code))
      throw new Error(`[@fadroma/ops/Build] Build of ${crate} exited with status ${code}`)
    }
    const codeHash = codeHashForPath(location)
    return { location, codeHash }
  }
}

export function getBuildContainerArgs (
  src:      string,
  ref:      string,
  output:   string,
  command?: string,
) {
  const Binds = [
    `${src}:/src:rw`,                         // Input
    `${output}:/output:rw`,                   // Output
    `project_cache_${ref}:/src/target:rw`,    // Cache
    `cargo_cache_${ref}:/usr/local/cargo:rw`, // Cache
  ]
  if (command) {
    Binds.push(`${command}:/entrypoint.sh:ro`)
  }
  return {
    Tty:         true,
    AttachStdin: true,
    Entrypoint:  ['/bin/sh', '-c'],
    HostConfig:  { Binds },
    Env: [
      'CARGO_NET_GIT_FETCH_WITH_CLI=true',
      'CARGO_TERM_VERBOSE=true',
      'CARGO_HTTP_TIMEOUT=240',
      'LOCKED=',//'--locked'
    ]
  }
}

/** Builds a contract in a Docker build container.
  * The info about the build container must be defined in a subclass. */
export abstract class DockerBuilder extends Builder {

  async build (source): Promise<Artifact> {

    // Temporary directory into which the working tree is copied
    // when building a non-HEAD commit.
    let tmpDir

    // Execute a shell command
    const run = (cmd: string, ...args: string[]) => spawnSync(
      cmd, args, { cwd: workspace, stdio: 'inherit' }
    )

    try {

      if (!ref || ref === 'HEAD') {

        // Build working tree
        console.info(
          `Building crate ${bold(crate)} ` +
          `from working tree at ${bold(workspace)} ` +
          `into ${bold(outputDir)}...`
        )

      } else {

        // Copy working tree into temporary directory and
        // checkout the commit that will be built
        console.info(
          `Building crate ${bold(crate)} ` +
          `from commit ${bold(ref)} ` +
          `into ${bold(outputDir)}...`
        )

        // Create the temporary directory
        tmpDir = tmp.dirSync({ prefix: 'fadroma_build', tmpdir: '/tmp' })
        console.info(
          `Copying source code from ${bold(workspace)} ` +
          `into ${bold(tmpDir.name)}`
        )

        // Copy the working tree into the temporary directory
        // and prepare it for a clean build
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

      // Show the user what is being built
      run('git', 'log', '-1')

      // Configuration of the build container
      const buildArgs = {
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
          'CARGO_HTTP_TIMEOUT=240',
          'LOCKED=',//'--locked'
        ]
      }

      // Run the build in the container
      const buildCommand = `bash /entrypoint.sh ${crate} ${ref}`
      console.debug(
        `Running ${bold(buildCommand)} in ${bold(buildImage)} with the following options:`,
        buildArgs
      )
      const [{ Error:err, StatusCode:code }, container] = await this.docker.run(
        buildImage, buildCommand, process.stdout, buildArgs
      )

      // Remove the container once it's exited
      await container.remove()

      // Throw error if build failed
      if (err) {
        throw new Error(`[@fadroma/ops/Build] Docker error: ${err}`)
      }
      if (code !== 0) {
        console.error(bold('Build of'), crate, 'exited with', bold(code))
        throw new Error(`[@fadroma/ops/Build] Build of ${crate} exited with status ${code}`)
      }

      return { location, codeHash: codeHashForPath(location) }

    } finally {

      // If a temporary directory was used, delete it
      if (tmpDir) rimraf(tmpDir.name)

    }

  }

}

export abstract class RawBuilder extends Builder {

  async build (source: Source): Promise<Artifact> {

    throw new Error('pls review')

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
