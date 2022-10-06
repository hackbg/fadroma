import { LocalBuilder, buildPackage, artifactName, sanitize } from './build-base'
import { BuildConsole } from './build-events'
import type { BuilderConfig } from './build-base'
import { getGitDir } from './build-history'

import * as Dokeres from '@hackbg/dokeres'
import { bold } from '@hackbg/konzola'
import $, { OpaqueDirectory } from '@hackbg/kabinet'

import { Contract, ContractTemplate, HEAD } from '@fadroma/client'
import type { Builder } from '@fadroma/client'

import { homedir } from 'node:os'

import { default as simpleGit } from 'simple-git'

/** This builder launches a one-off build container using Dockerode. */
export class DockerBuilder extends LocalBuilder {

  readonly id = 'docker-local'

  constructor (opts: Partial<BuilderConfig & { docker?: Dokeres.Engine }> = {}) {
    super(opts)
    const { docker, dockerSocket, dockerImage } = opts
    // Set up Docker API handle
    if (dockerSocket) {
      this.docker = new Dokeres.Engine(dockerSocket)
    } else if (docker) {
      this.docker = docker
    } else {
      this.docker = new Dokeres.Engine()
    }
    if ((dockerImage as unknown) instanceof Dokeres.Image) {
      this.image = opts.dockerImage as unknown as Dokeres.Image
    } else if (opts.dockerImage) {
      this.image = new Dokeres.Image(this.docker, opts.dockerImage)
    } else {
      this.image = new Dokeres.Image(this.docker, 'ghcr.io/hackbg/fadroma:unstable')
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
  /** Logger */
  log = new BuildConsole('Builder: Docker')
  /** Used to launch build container. */
  docker: Dokeres.Engine
  /** Tag of the docker image for the build container. */
  image:  Dokeres.Image
  /** Path to the dockerfile to build the build container if missing. */
  dockerfile: string
  /** Build a Source into a Template. */
  async build (contract: ContractTemplate): Promise<ContractTemplate> {
    const [result] = await this.buildMany([contract])
    return result
  }

  /** This implementation groups the passed source by workspace and ref,
    * in order to launch one build container per workspace/ref combination
    * and have it build all the crates from that combination in sequence,
    * reusing the container's internal intermediate build cache. */
  async buildMany (contracts: ContractTemplate[]): Promise<ContractTemplate[]> {
    const roots     = new Set<string>()
    const revisions = new Set<string>()
    let longestCrateName = 0
    // For each contract, collect built info and populate it if found in the cache
    for (const contract of contracts) {
      if (contract.crate && contract.crate.length > longestCrateName) {
        longestCrateName = contract.crate.length
      }
      if (!this.prebuilt(contract)) {
        this.log.buildingOne(contract)
        contract.builder = this as Builder
        roots.add(contract.workspace!)
        revisions.add(contract.revision!)
      }
    }
    // For each workspace/ref pair
    for (const path of roots) for (const revision of revisions) {
      let mounted = $(path)
      if (this.verbose) this.log.buildingFromWorkspace(mounted, revision)
      if (revision !== HEAD) {
        const gitDir = getGitDir({ workspace: path })
        mounted = gitDir.rootRepo
        //console.info(`Using history from Git directory: `, bold(`${mounted.shortPath}/`))
        const remote = process.env.FADROMA_PREFERRED_REMOTE || 'origin'
        try {
          await simpleGit(gitDir.path).fetch(remote)
        } catch (e) {
          console.warn(`Git fetch from remote ${remote} failed. Build may fail or produce an outdated result.`)
          console.warn(e)
        }
      }
      // Create a list of sources for the container to build,
      // along with their indices in the input and output arrays
      // of this function.
      const crates: [number, string][] = []
      for (let index = 0; index < contracts.length; index++) {
        const source = contracts[index]
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
      for (const index in results) {
        if (!results[index]) continue
        contracts[index].artifact = results[index]!.artifact
        contracts[index].codeHash = results[index]!.codeHash
      }
    }
    return contracts
  }

  private prebuilt (contract: ContractTemplate): boolean {
    const { workspace, revision, crate } = contract
    if (!workspace) throw new Error("Workspace not set, can't build")
    const prebuilt = this.prebuild(this.outputDir.path, crate, revision)
    if (prebuilt) {
      this.log.prebuilt(prebuilt)
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
  ): Promise<(ContractTemplate|null)[]> {
    // Create output directory as user if it does not exist
    $(outputDir).as(OpaqueDirectory).make()

    // Output slots. Indices should correspond to those of the input to buildMany
    const templates:   (ContractTemplate|null)[] = crates.map(()=>null)

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
    if (!this.script) throw new Error('Build script not set.')
    const buildScript   = $(`/`, $(this.script).name).path
    const safeRef       = sanitize(revision)
    const knownHosts    = $(homedir()).in('.ssh').at('known_hosts')
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
    const command = [ 'node', buildScript, 'phase1', revision, ...cratesToBuild ]
    const extra   = { Tty: true, AttachStdin: true, }
    const options = { remove: true, readonly, writable, cwd: '/src', env, extra }

    //console.info('Building with command:', bold(command.join(' ')))
    //console.debug('Building in a container with this configuration:', options)
    // Prepare the log output stream
    const buildLogPrefix = `[${revision}]`.padEnd(16)
    const transformLine  = (line:string)=>`${bold('BUILD')} @ ${revision} │ ${line}`
    const logs = new Dokeres.LineTransformStream(transformLine)
    logs.pipe(process.stdout)

    // Run the build container
    this.log.log(`Building from ${$(root).shortPath} @ ${revision}:`, cratesToBuild.map(x=>bold(x)).join(', '))
    const buildName      = `fadroma-build-${sanitize($(root).name)}@${revision}`
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

  private locationToContract (location: any) {
    if (location === null) return null
    const artifact = $(location).url
    const codeHash = this.hashPath(location)
    return new Contract({ artifact, codeHash })
  }

  get [Symbol.toStringTag]() { return `${this.image?.name??'-'} -> ${this.outputDir?.shortPath??'-'}` }

}

export const distinct = <T> (x: T[]): T[] => [...new Set(x) as any]
