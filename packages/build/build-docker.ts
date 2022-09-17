import { LocalBuilder, BuildConsole, buildPackage } from './build-base'
import type { LocalBuilderOptions } from './build-base'
import * as Dokeres from '@hackbg/dokeres'

export interface DockerBuilderOptions extends LocalBuilderOptions {
  /** Path to Docker API endpoint. */
  socketPath: string
  /** Docker API client instance. */
  docker:     Dokeres.Engine
  /** Build image. */
  image:      string|Dokeres.Image
  /** Dockerfile for building the build image. */
  dockerfile: string
}

/** This builder launches a one-off build container using Dockerode. */
export class DockerBuilder extends LocalBuilder {

  readonly id = 'docker-local'

  constructor (opts: Partial<DockerBuilderOptions> = {}) {
    super(opts)
    // Set up Docker API handle
    if (opts.socketPath) {
      this.docker = new Dokeres.Engine(this.socketPath = opts.socketPath)
    } else if (opts.docker) {
      this.docker = opts.docker
    }
    if (opts.image instanceof Dokeres.Image) {
      this.image = opts.image
    } else if (opts.image) {
      this.image = new Dokeres.Image(this.docker, opts.image)
    } else {
      this.image = new Dokeres.Image(this.docker, 'ghcr.io/hackbg/fadroma:unstable')
    }
    // Set up Docker image
    this.dockerfile ??= opts.dockerfile!
    this.script     ??= opts.script!
  }

  log = new BuildConsole('Fadroma.DockerBuilder')

  /** Used to launch build container. */
  socketPath: string  = '/var/run/docker.sock'

  /** Used to launch build container. */
  docker:     Dokeres.Engine = new Dokeres.Engine(this.socketPath)

  /** Tag of the docker image for the build container. */
  image:      Dokeres.Image

  /** Path to the dockerfile to build the build container if missing. */
  dockerfile: string

  /** Build a Source into a Template */
  async build (source: Contract<any>): Promise<Contract<any>> {
    return (await this.buildMany([source]))[0]
  }

  /** This implementation groups the passed source by workspace and ref,
    * in order to launch one build container per workspace/ref combination
    * and have it build all the crates from that combination in sequence,
    * reusing the container's internal intermediate build cache. */
  async buildMany (inputs: Contract<any>[]): Promise<Contract<any>[]> {

    const longestCrateName = inputs
      .map(source=>source.crate?.length||0)
      .reduce((x,y)=>Math.max(x,y),0)

    for (const source of inputs) {
      const { gitRepo, gitRef, crate } = source
      if (!gitRepo) throw new Error('missing source.gitRepo')
      const outputDir = $(gitRepo).resolve(this.outputDirName)
      const prebuilt  = this.prebuild(outputDir, crate, gitRef)
      this.log.buildingOne(source, prebuilt)
    }

    // Collect a mapping of workspace path -> Workspace object
    const workspaces: Record<string, Contract<any>> = {}
    for (const source of inputs) {
      const { gitRepo, gitRef, workspace } = source
      const gitDir = getGitDir(source)
      if (!gitRepo) throw new Error('missing source.gitRepo')
      if (!workspace) throw new Error('missing source.workspace')
      workspaces[workspace] = new Contract({ workspace })
      // No way to checkout non-`HEAD` ref if there is no `.git` dir
      if (gitRef !== HEAD && !gitDir?.present) {
        const error = new Error("Fadroma Build: could not find Git directory for source.")
        throw Object.assign(error, { source })
      }
    }

    // Here we will collect the build outputs
    const outputs: Contract<any>[] = inputs.map(input=>new Contract({ ...input, builder: this }))

    // Get the distinct workspaces and refs by which to group the crate builds
    const roots:   string[] = distinct(inputs.map(source=>source.workspace!))
    const gitRefs: string[] = distinct(inputs.map(source=>source.gitRef??HEAD))

    // For each workspace/ref pair
    for (const path of roots) for (const gitRef of gitRefs) {
      await buildFor.call(this, path, gitRef)
    }

    return outputs

    const self = this
    async function buildFor (this: typeof self, path: string, gitRef: string) {
      let mounted = $(path)
      if (this.verbose) this.log.buildingFromWorkspace(mounted, gitRef)
      if (gitRef !== HEAD) {
        const gitDir = getGitDir(workspaces[path])
        mounted = gitDir.rootRepo
        //console.info(`Using history from Git directory: `, bold(`${mounted.shortPath}/`))
        await simpleGit(gitDir.path)
          .fetch(process.env.FADROMA_PREFERRED_REMOTE || 'origin')
      }
      // Create a list of sources for the container to build,
      // along with their indices in the input and output arrays
      // of this function.
      const crates: [number, string][] = []
      for (let index = 0; index < inputs.length; index++) {
        const source = inputs[index]
        if (source.workspace === path && source.gitRef === gitRef) {
          crates.push([index, source.crate!])
        }
      }
      // Build the crates from each same workspace/gitRef pair and collect the results.
      // sequentially in the same container.
      // Collect the templates built by the container
      const results = await this.runBuildContainer(
        mounted.path,
        mounted.relative(path),
        gitRef,
        crates,
        (gitRef !== HEAD)
          ? (gitDir=>gitDir.isSubmodule?gitDir.submoduleDir:'')(getGitDir(workspaces[path]))
          : ''
      )
      for (const index in results) {
        if (!results[index]) continue
        outputs[index] = new Contract({ ...results[index], ...inputs[index] })
      }
    }

  }

  protected async runBuildContainer (
    root:      string,
    subdir:    string,
    gitRef:       string,
    crates:    [number, string][],
    gitSubdir: string = '',
    outputDir: string = $(root, subdir, this.outputDirName).path,
  ): Promise<(Contract<any>|null)[]> {
    // Create output directory as user if it does not exist
    $(outputDir).as(Kabinet.OpaqueDirectory).make()

    // Output slots. Indices should correspond to those of the input to buildMany
    const templates:   (Contract<any>|null)[] = crates.map(()=>null)

    // Whether any crates should be built, and at what indices they are in the input and output.
    const shouldBuild: Record<string, number> = {}

    // Collect cached templates. If any are missing from the cache mark them as buildable.
    for (const [index, crate] of crates) {
      const prebuilt = this.prebuild(outputDir, crate, gitRef)
      if (prebuilt) {
        const location = $(prebuilt.artifact!).shortPath
        //console.info('Exists, not rebuilding:', bold($(location).shortPath))
        templates[index] = prebuilt
      } else {
        shouldBuild[crate] = index
      }
    }

    // If there are no templates to build, this means everything was cached and we're done.
    if (Object.keys(shouldBuild).length === 0) {
      return templates
    }

    // Define the mounts and environment variables of the build container
    const buildScript   = `/${basename(this.script)}`
    const safeRef       = sanitize(gitRef)
    const knownHosts    = $(`${homedir()}/.ssh/known_hosts`)
    const etcKnownHosts = $(`/etc/ssh/ssh_known_hosts`)
    const readonly = {
      // The script that will run in the container
      [this.script]:                buildScript,
      // Root directory of repository, containing real .git directory
      [$(root).path]:              `/src`,
      // For non-interactively fetching submodules over SSH, we need to propagate known_hosts
      ...(knownHosts.isFile()    ? { [knownHosts.path]:     '/root/.ssh/known_hosts'   } : {}),
      ...(etcKnownHosts.isFile() ? { [etcKnownHosts.path] : '/etc/ssh/ssh_known_hosts' } : {}),
    }

    // For fetching from private repos, we need to give the container access to ssh-agent
    if (process.env.SSH_AUTH_SOCK) readonly[process.env.SSH_AUTH_SOCK] = '/ssh_agent_socket'
    const writable = {
      // Output path for final artifacts
      [outputDir]:                  `/output`,
      // Persist cache to make future rebuilds faster. May be unneccessary.
      //[`project_cache_${safeRef}`]: `/tmp/target`,
      [`cargo_cache_${safeRef}`]:   `/usr/local/cargo`
    }

    // Since Fadroma can be included as a Git submodule, but
    // Cargo doesn't support nested workspaces, Fadroma's
    // workpace root manifest is renamed to _Cargo.toml.
    // Here we can mount it under its proper name
    // if building the example contracts from Fadroma.
    if (process.env.FADROMA_BUILD_WORKSPACE_MANIFEST) {
      if (gitRef !== HEAD) {
        throw new Error(
          'Fadroma Build: FADROMA_BUILD_WORKSPACE_ROOT can only' +
          'be used when building from working tree'
        )
      }
      writable[$(root).path] = readonly[$(root).path]
      delete readonly[$(root).path]
      readonly[$(process.env.FADROMA_BUILD_WORKSPACE_MANIFEST).path] = `/src/Cargo.toml`
    }

    // Variables used by the build script are prefixed with underscore
    // and variables used by the tools used by the build script are left as is
    const env = {
      _BUILD_USER:                  process.env.FADROMA_BUILD_USER || 'fadroma-builder',
      _BUILD_UID:                   process.env.FADROMA_BUILD_UID  || process.getuid(),
      _BUILD_GID:                   process.env.FADROMA_BUILD_GID  || process.getgid(),
      _GIT_REMOTE:                  process.env.FADROMA_PREFERRED_REMOTE||'origin',
      _GIT_SUBDIR:                  gitSubdir,
      _SUBDIR:                      subdir,
      _NO_FETCH:                    this.noFetch,
      CARGO_HTTP_TIMEOUT:           '240',
      CARGO_NET_GIT_FETCH_WITH_CLI: 'true',
      GIT_PAGER:                    'cat',
      GIT_TERMINAL_PROMPT:          '0',
      LOCKED:                       '',/*'--locked'*/
      SSH_AUTH_SOCK:                '/ssh_agent_socket',
      TERM:                         process.env.TERM,
    }

    // Pre-populate the list of expected artifacts.
    const outputWasms: Array<string|null> = [...new Array(crates.length)].map(()=>null)
    for (const [crate, index] of Object.entries(shouldBuild)) {
      outputWasms[index] = $(outputDir, artifactName(crate, safeRef)).path
    }

    // Pass the compacted list of crates to build into the container
    const cratesToBuild = Object.keys(shouldBuild)
    const command = [ 'node', buildScript, 'phase1', gitRef, ...cratesToBuild ]
    const extra   = { Tty: true, AttachStdin: true, }
    const options = { remove: true, readonly, writable, cwd: '/src', env, extra }

    //console.info('Building with command:', bold(command.join(' ')))
    //console.debug('Building in a container with this configuration:', options)
    // Prepare the log output stream
    const buildLogPrefix = `[${gitRef}]`.padEnd(16)
    const transformLine  = (line:string)=>`[Fadroma Build] ${buildLogPrefix} ${line}`
    const logs = new Dokeres.LineTransformStream(transformLine)
    logs.pipe(process.stdout)

    // Run the build container
    const rootName       = sanitize(basename(root))
    const buildName      = `fadroma-build-${rootName}@${gitRef}`
    const buildContainer = await this.image.run(buildName, options, command, '/usr/bin/env', logs)
    const {Error: err, StatusCode: code} = await buildContainer.wait()

    // Throw error if launching the container failed
    if (err) {
      throw new Error(`[@fadroma/build] Docker error: ${err}`)
    }

    // Throw error if the build failed
    if (code !== 0) {
      const crateList = cratesToBuild.join(' ')
      this.log.error(
        'Build of crates:',   bold(crateList),
        'exited with status', bold(code)
      )
      throw new Error(
        `[@fadroma/build] Build of crates: "${crateList}" exited with status ${code}`
      )
    }

    // Return a sparse array of the resulting artifacts
    return outputWasms.map(this.locationToContract)

  }

  private locationToContract = (location: any) => {
    if (location === null) return null
    const artifact = $(location).url
    const codeHash = this.codeHashForPath(location)
    return new Contract({ artifact, codeHash })
  }

}
