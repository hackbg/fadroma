import { BuildConsole, Error } from '../util'
import type { BuilderConfig } from '../util'

import LocalBuilder, { artifactName, sanitize, buildPackage } from './LocalBuilder'
import getGitDir from './getGitDir'

import { Builder, Contract, HEAD, bold } from '@fadroma/agent'
import type { BuilderClass, Buildable, Built } from '@fadroma/agent'

import { Engine, Image, Docker, Podman, LineTransformStream } from '@hackbg/dock'
import $, { Path, OpaqueDirectory } from '@hackbg/file'

import { default as simpleGit } from 'simple-git'

import { homedir } from 'node:os'

/** This builder launches a one-off build container using Dockerode. */
export default class BuildContainer extends LocalBuilder {

  readonly id = 'Container'

  /** Logger */
  log = new BuildConsole('@fadroma/ops: BuildContainer')

  /** Used to launch build container. */
  docker: Engine

  /** Tag of the docker image for the build container. */
  image: Image

  /** Path to the dockerfile to build the build container if missing. */
  dockerfile: string

  constructor (opts: Partial<BuilderConfig & { docker?: Engine }> = {}) {
    super(opts)
    const { docker, dockerSocket, dockerImage } = opts
    // Set up Docker API handle
    const Containers = opts.podman ? Podman : Docker
    if (dockerSocket) {
      this.docker = new Containers.Engine(dockerSocket)
    } else if (docker) {
      this.docker = docker
    } else {
      this.docker = new Containers.Engine()
    }
    if ((dockerImage as unknown) instanceof Containers.Image) {
      this.image = opts.dockerImage as unknown as Image
    } else if (opts.dockerImage) {
      this.image = this.docker.image(opts.dockerImage)
    } else {
      this.image = this.docker.image('ghcr.io/hackbg/fadroma:master')
    }
    // Set up Docker image
    this.dockerfile ??= opts.dockerfile!
    this.script     ??= opts.script!
    for (const hide of [
      'log', 'name', 'description', 'timestamp',
      'commandTree', 'currentCommand',
      'args', 'task', 'before'
    ]) Object.defineProperty(this, hide, { enumerable: false, writable: true })
  }

  /** Build a Source into a Template. */
  async build (contract: Buildable): Promise<Built> {
    const [result] = await this.buildMany([contract])
    return result
  }

  /** This implementation groups the passed source by workspace and ref,
    * in order to launch one build container per workspace/ref combination
    * and have it build all the crates from that combination in sequence,
    * reusing the container's internal intermediate build cache. */
  async buildMany (contracts: (string|(Buildable & Partial<Built>))[]): Promise<Built[]> {
    // Copy the argument because we'll mutate it later on
    contracts = [...contracts]
    // For batching together contracts from the same repo+commit
    const workspaces = new Set<string>()
    const revisions  = new Set<string>()
    // For indentation
    let longestCrateName = 0
    // Go over the list of contracts, filtering out the ones that are already built,
    // and collecting the source repositories and revisions. This will allow for
    // multiple crates from the same source checkout to be passed to a single build command.
    for (let id in contracts) {
      // Contracts passed as strins are converted to object here
      if (typeof contracts[id] === 'string') contracts[id] = {
        workspace: this.workspace,
        revision:  'HEAD',
        crate:     contracts[id] as string,
      }
      const contract = contracts[id] as Buildable & Partial<Built>
      // Collect maximum length to align console output
      if (contract.crate && contract.crate.length > longestCrateName) {
        longestCrateName = contract.crate.length
      }
      // If the contract is already built, don't build it again
      if (!this.prebuilt(contract)) {
        this.log.buildingOne(contract)
        // Set ourselves as the contract's builder
        contract.builder = this as unknown as Builder
        // Add the source repository of the contract to the list of sources to build
        workspaces.add(contract.workspace!)
        revisions.add(contract.revision!)
      }
    }
    // For each repository/revision pair, build the contracts from it.
    for (const path of workspaces) {
      for (const revision of revisions) {
        this.log.log('Building from', path, '@', revision)
        // Which directory to mount into the build container? By default,
        // this is the root of the workspace. But if the workspace is not
        // at the root of the Git repo (e.g. when using Git submodules),
        // a parent directory may need to be mounted to get the full
        // Git history.
        let mounted = $(path)
        if (this.verbose) this.log.buildingFromWorkspace(mounted, revision)
        // If we're building from history, update `mounted` to make sure
        // that the full contents of the Git repo will be mounted in the
        // build container.
        if (revision !== HEAD) {
          const gitDir = getGitDir({ workspace: path })
          mounted = gitDir.rootRepo
          const remote = process.env.FADROMA_PREFERRED_REMOTE || 'origin'
          try {
            await this.fetch(gitDir, remote)
          } catch (e) {
            console.warn(`Git fetch from remote ${remote} failed. Build may fail or produce an outdated result.`)
            console.warn(e)
          }
        }
        // Match each crate from the current repo/ref pair
        // with its index in the originally passed list of contracts.
        const crates: [number, string][] = []
        for (let index = 0; index < contracts.length; index++) {
          const source = contracts[index] as Buildable & Partial<Built>
          if (source.workspace === path && source.revision === revision) {
            crates.push([index, source.crate!])
          }
        }
        // Build the crates from each same workspace/revision pair and collect the results.
        // sequentially in the same container.
        // Collect the templates built by the container
        const results = await this.runBuildContainer(
          mounted.path,
          mounted.relative(path),
          revision,
          crates,
          (revision !== HEAD)
            ? (gitDir=>gitDir.isSubmodule?gitDir.submoduleDir:'')(getGitDir({ workspace: path }))
            : ''
        )
        // Using the previously collected indices,
        // populate the values in each of the passed contracts.
        for (const index in results) {
          if (!results[index]) continue
          const contract = contracts[index] as Buildable & Partial<Built>
          contract.artifact = results[index]!.artifact
          contract.codeHash = results[index]!.codeHash
        }
      }
    }
    return contracts as Built[]
  }

  protected async fetch (gitDir: Path, remote: string) {
    await simpleGit(gitDir.path).fetch(remote)
  }

  protected prebuilt (contract: Buildable & Partial<Built>): boolean {
    const { workspace, revision, crate } = contract
    //if (!workspace) throw new Error(`Workspace not set, can't build crate "${contract.crate}"`)
    const prebuilt = this.prebuild(this.outputDir.path, crate, revision)
    if (prebuilt) {
      new BuildConsole(`BuildContainer: ${crate}`).prebuilt(prebuilt)
      contract.artifact = prebuilt.artifact
      contract.codeHash = prebuilt.codeHash
      return true
    }
    return false
  }

  protected async runBuildContainer (
    root:      string,
    subdir:    string,
    revision:  string,
    crates:    [number, string][],
    gitSubdir: string = '',
    outputDir: string = this.outputDir.path
  ): Promise<(Built|null)[]> {
    // Default to building from working tree.
    revision ??= HEAD

    // Create output directory as user if it does not exist
    $(outputDir).as(OpaqueDirectory).make()

    // Output slots. Indices should correspond to those of the input to buildMany
    const templates: Array<Built|null> = crates.map(()=>null)

    // Whether any crates should be built, and at what indices they are in the input and output.
    const shouldBuild: Record<string, number> = {}

    // Collect cached templates. If any are missing from the cache mark them as buildable.
    for (const [index, crate] of crates) {
      const prebuilt = this.prebuild(outputDir, crate, revision)
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
    if (!this.script) throw new Error.Build('Build script not set.')
    const buildScript = $(`/`, $(this.script).name).path
    const safeRef = sanitize(revision)
    const knownHosts = $(homedir()).in('.ssh').at('known_hosts')
    const etcKnownHosts = $(`/etc/ssh/ssh_known_hosts`)
    const readonly = {
      // The script that will run in the container
      [this.script]:  buildScript,
      // Root directory of repository, containing real .git directory
      [$(root).path]: `/src`,
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
      if (revision !== HEAD) {
        throw new Error(
          'Fadroma Build: FADROMA_BUILD_WORKSPACE_ROOT can only' +
          'be used when building from working tree'
        )
      }
      writable[$(root).path] = readonly[$(root).path]
      delete readonly[$(root).path]
      readonly[$(process.env.FADROMA_BUILD_WORKSPACE_MANIFEST).path] = `/src/Cargo.toml`
    }

    // Pre-populate the list of expected artifacts.
    const outputWasms: Array<string|null> = [...new Array(crates.length)].map(()=>null)
    for (const [crate, index] of Object.entries(shouldBuild)) {
      outputWasms[index] = $(outputDir, artifactName(crate, safeRef)).path
    }

    // Pass the compacted list of crates to build into the container
    const cratesToBuild = Object.keys(shouldBuild)
    const buildCommand = [ 'node', buildScript, 'phase1', revision, ...cratesToBuild ]

    const buildEnv = {
      // Variables used by the build script are prefixed with underscore;
      // variables used by the tools that the build script uses are left as is
      _BUILD_USER: process.env.FADROMA_BUILD_USER ?? 'fadroma-builder',
      _BUILD_UID:  process.env.FADROMA_BUILD_UID ?? (process.getgid ? process.getgid() : undefined),
      _BUILD_GID:  process.env.FADROMA_BUILD_GID ?? (process.getuid ? process.getuid() : undefined),
      _GIT_REMOTE: process.env.FADROMA_PREFERRED_REMOTE ?? 'origin',
      _GIT_SUBDIR: gitSubdir,
      _SUBDIR:     subdir,
      _NO_FETCH:   String(this.noFetch),
      _VERBOSE:    String(this.verbose),

      LOCKED: '',/*'--locked'*/
      CARGO_HTTP_TIMEOUT: '240',
      CARGO_NET_GIT_FETCH_WITH_CLI: 'true',
      GIT_PAGER: 'cat',
      GIT_TERMINAL_PROMPT: '0',
      SSH_AUTH_SOCK: '/ssh_agent_socket',
      TERM: process.env.TERM,
    }

    // Clean up the buildEnv so as not to run afoul of TS
    for (const key of Object.keys(buildEnv)) {
      if (buildEnv[key as keyof typeof buildEnv] === undefined) {
        delete buildEnv[key as keyof typeof buildEnv]
      }
    }

    const buildOptions = {
      remove: true,
      readonly,
      writable,
      cwd: '/src',
      env: buildEnv as Record<string, string>,
      extra: {
        Tty: true,
        AttachStdin: true
      }
    }

    // This stream collects the output from the build container, i.e. the build logs.
    const buildLogStream = new LineTransformStream((!this.quiet)
      // In normal and verbose mode, build logs are printed to the console in real time,
      // with an addition prefix to show what is being built.
      ? (line:string)=>`${bold('BUILD')} @ ${revision} │ ${line}`
      // In quiet mode the logs are collected into a string as-is,
      // and are only printed if the build fails.
      : (line:string)=>line)
    let buildLogs = ''
    if (!this.quiet) {
      // In verbose mode, build logs are piped directly to the console
      buildLogStream.pipe(process.stdout)
    } else {
      // In non-verbose mode, build logs are collected in a string
      buildLogStream.on('data', (data: string) => buildLogs += data)
    }

    // Run the build container
    this.log.runningBuildContainer(root, revision, cratesToBuild)
    const buildName = `fadroma-build-${sanitize($(root).name)}@${revision}`
    const buildContainer = await this.image.run(
      buildName,      // container name
      buildOptions,   // container options
      buildCommand,   // container arguments
      '/usr/bin/env', // container entrypoint command
      buildLogStream  // container log stream
    )
    const {error, code} = await buildContainer.wait()

    // Throw error if launching the container failed
    if (error) {
      throw new Error(`[@fadroma/ops] Docker error: ${error}`)
    }

    // Throw error if the build failed
    if (code !== 0) this.buildFailed(cratesToBuild, code, buildLogs)

    // Return a sparse array of the resulting artifacts
    return outputWasms.map(x=>this.locationToContract(x) as Built)

  }

  protected buildFailed (crates: string[], code: string|number, logs: string) {
    const crateList = crates.join(' ')
    this.log.log(logs)
    this.log.error('Build of crates:', bold(crateList), 'exited with status', bold(String(code)))
    throw new Error(`[@fadroma/ops] Build of crates: "${crateList}" exited with status ${code}`)
  }

  protected locationToContract (location: any) {
    if (location === null) return null
    const artifact = $(location).url
    const codeHash = this.hashPath(location)
    return new Contract({ artifact, codeHash })
  }

  get [Symbol.toStringTag]() {
    return `${this.image?.name??'-'} -> ${this.outputDir?.shortPath??'-'}`
  }

}

Builder.variants['Container'] = BuildContainer as unknown as BuilderClass<Builder>

export const distinct = <T> (x: T[]): T[] =>
  [...new Set(x) as any]
