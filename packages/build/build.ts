import { Artifact }                           from '@fadroma/client'
import $, { Path, TextFile, OpaqueDirectory } from '@hackbg/kabinet'
import { Console, bold }                      from '@hackbg/konzola'
import { toHex, Sha256 }                      from '@hackbg/formati'
import { Environment }                        from '@hackbg/komandi'
import { Dokeres, DokeresImage }              from '@hackbg/dokeres'
import simpleGit                              from 'simple-git'
import LineTransformStream                    from 'line-transform-stream'
import { compileFromFile }                    from 'json-schema-to-typescript'
import { parse as parseToml }                 from 'toml'

import { spawn, execFileSync }               from 'child_process'
import { basename, resolve, dirname }        from 'path'
import { homedir, tmpdir }                   from 'os'
import { URL, pathToFileURL, fileURLToPath } from 'url'
import { readFileSync, mkdtempSync, readdirSync, writeFileSync } from 'fs'

const console = Console('Fadroma Build')

export const HEAD            = 'HEAD'
export const distinct        = <T> (x: T[]): T[] => [...new Set(x) as any]
export const sanitize        = ref => ref.replace(/\//g, '_')
export const artifactName    = (crate, ref) => `${crate}@${sanitize(ref)}.wasm`
export const codeHashForBlob = (blob: Uint8Array) => toHex(new Sha256(blob).digest())
export const codeHashForPath = (location: string) => codeHashForBlob(readFileSync(location))

//@ts-ignore
export const __dirname = dirname(fileURLToPath(import.meta.url))

/** Represents a Cargo workspace containing multiple smart contract crates.
  * - Select a crate with `new Workspace(path).crate(name)`
  * - Select from past commit with `new Workspace(path).at(ref).crate(name)`
  * - Use `.crates([name1, name2])` to get multiple crates */
export class Workspace {
  constructor (
    public readonly path:   string,
    public readonly ref:    string = HEAD,
    public readonly gitDir: DotGit = new DotGit(path)
  ) {}
  /** Create a new instance of the same workspace that will
    * return Source objects pointing to a specific Git ref. */
  at (ref: string): this {
    interface WorkspaceCtor<W> { new (path: string, ref?: string, gitDir?: DotGit): W }
    return new (this.constructor as WorkspaceCtor<typeof this>)(this.path, ref, this.gitDir)
  }
  /** Get a Source object pointing to a crate from the current workspace and ref */
  crate (crate: string): Source {
    if (crate.indexOf('@') > -1) {
      const [name, ref] = crate.split('@')
      return new Source(this.at(ref), name)
    }
    return new Source(this, crate)
  }
  /** Get multiple Source objects pointing to crates from the current workspace and ref */
  crates (crates: string[]): Source[] {
    return crates.map(crate=>this.crate(crate))
  }
}

/** Represents the real location of the Git data directory.
  * - In standalone repos this is `.git/`
  * - If the contracts workspace repository is a submodule,
  *   `.git` will be a file containing e.g. "gitdir: ../.git/modules/something" */
export class DotGit extends Path {
  constructor (base, ...fragments) {
    super(base, ...fragments, '.git')
    if (!this.exists()) {
      // If .git does not exist, it is not possible to build past commits
      console.warn(bold(this.shortPath), 'does not exist')
      this.present = false
    } else if (this.isFile()) {
      // If .git is a file, the workspace is contained in a submodule
      const gitPointer = this.as(TextFile).load().trim()
      const prefix = 'gitdir:'
      if (gitPointer.startsWith(prefix)) {
        // If .git contains a pointer to the actual git directory,
        // building past commits is possible.
        const gitRel  = gitPointer.slice(prefix.length).trim()
        const gitPath = $(this.parent, gitRel).path
        const gitRoot = $(gitPath)
        //console.info(bold(this.shortPath), 'is a file, pointing to', bold(gitRoot.shortPath))
        this.path      = gitRoot.path
        this.present   = true
        this.isSubmodule = true
      } else {
        // Otherwise, who knows?
        console.info(bold(this.shortPath), 'is an unknown file.')
        this.present = false
      }
    } else if (this.isDirectory()) {
      // If .git is a directory, this workspace is not in a submodule
      // and it is easy to build past commits
      this.present = true
    } else {
      // Otherwise, who knows?
      console.warn(bold(this.shortPath), `is not a file or directory`)
      this.present = false
    }
  }
  readonly present:     boolean
  readonly isSubmodule: boolean = false
  get rootRepo     (): Path   { return $(this.path.split(DotGit.rootRepoRE)[0]) }
  get submoduleDir (): string { return this.path.split(DotGit.rootRepoRE)[1]    }
  /* Matches "/.git" or "/.git/" */
  static rootRepoRE = new RegExp(`${Path.separator}.git${Path.separator}?`)
}

export class Source {
  constructor (
    public readonly workspace: Workspace,
    public readonly crate:     string,
  ) {}
  build (builder: Builder): Promise<Artifact> {
    return builder.build(this)
  }
  at (ref?: string): Source {
    if (!ref) return this
    return new Source(new Workspace(this.workspace.path, ref, this.workspace.gitDir), this.crate)
  }
}

/** Can perform builds. */
export abstract class Builder {
  outputDirName = 'artifacts'
  abstract build (source: Source, ...args): Promise<Artifact>
  buildMany (sources: Source[], ...args): Promise<Artifact[]> {
    return Promise.all(sources.map(source=>this.build(source, ...args)))
  }
}

export interface BuilderOptions {
  rebuild:    boolean
  caching:    boolean
  raw:        boolean
  managerUrl: string|URL
  image:      string
  dockerfile: string
  script:     string
  service:    string
  noFetch:    boolean
  toolchain:  string
}

/** Can perform builds, if necessary or if explicitly asked (by setting FADROMA_REBUILD=1) */
export abstract class CachingBuilder extends Builder {
  /** Check if artifact exists in local artifacts cache directory.
    * If it does, don't rebuild it but return it from there. */ 
  protected prebuild (outputDir: string, crate: string, ref: string = HEAD): Artifact|null {
    if (!this.caching) {
      return null
    }
    //console.log({outputDir, crate, ref}, artifactName(crate, ref))
    const location = $(outputDir, artifactName(crate, ref))
    if (location.exists()) {
      return new Artifact(location.url, codeHashForPath(location.path))
    }
    return null
  }
  caching: boolean = true
  constructor ({ caching = true } = {}) {
    super()
    this.caching = caching
  }
}

export interface DockerBuilderOptions {
  socketPath: string
  docker:     Dokeres
  image:      string|DokeresImage
  dockerfile: string
  script:     string
  caching:    boolean
  service:    string
}

/** This builder launches a one-off build container using Dockerode. */
export class DockerBuilder extends CachingBuilder {
  static image      = 'hackbg/fadroma:unstable'
  static dockerfile = resolve(__dirname, 'build.Dockerfile')
  static script     = resolve(__dirname, 'build-impl.mjs')
  static service    = resolve(__dirname, 'build-server.mjs')
  constructor ({
    caching,
    socketPath,
    docker,
    image,
    dockerfile,
    script
  }: Partial<DockerBuilderOptions> = {}) {
    super({ caching })
    // Set up Docker API handle
    if (socketPath) {
      this.docker = new Dokeres(this.socketPath = socketPath)
    } else if (docker) {
      this.docker = docker
    }
    if (image instanceof DokeresImage) {
      this.image = image
    } else if (image) {
      this.image = new DokeresImage(this.docker, image)
    } else {
      this.image = new DokeresImage(this.docker, 'ghcr.io/hackbg/fadroma:unstable')
    }
    // Set up Docker image
    this.dockerfile = dockerfile
    this.script     = script
  }
  /** Used to launch build container. */
  socketPath: string  = '/var/run/docker.sock'
  /** Used to launch build container. */
  docker:     Dokeres = new Dokeres(this.socketPath)
  /** Tag of the docker image for the build container. */
  image:      DokeresImage
  /** Path to the dockerfile to build the build container if missing. */
  dockerfile: string
  /** Path to the build script to be mounted and executed in the container. */
  script:     string
  /** Build a Source into an Artifact */
  async build (source: Source): Promise<Artifact> {
    return (await this.buildMany([source]))[0]
  }
  /** This implementation groups the passed source by workspace and ref,
    * in order to launch one build container per workspace/ref combination
    * and have it build all the crates from that combination in sequence,
    * reusing the container's internal intermediate build cache. */
  async buildMany (sources: Source[]): Promise<Artifact[]> {
    // Announce what will be done
    //console.info('Requested to build the following contracts:')
    const longestCrateName = sources.map(source=>source.crate.length).reduce((x,y)=>Math.max(x,y),0)
    for (const source of sources) {
      const outputDir = $(source.workspace.path).resolve(this.outputDirName)
      const prebuilt  = this.prebuild(outputDir, source.crate, source.workspace.ref)
      //console.info(
        //' ',    bold(source.crate.padEnd(longestCrateName)),
        //'from', bold(`${$(source.workspace.path).shortPath}/`),
        //'@',    bold(source.workspace.ref),
        //prebuilt ? '(exists, not rebuilding)': ''
      //)
    }
    // Collect a mapping of workspace path -> Workspace object
    const workspaces: Record<string, Workspace> = {}
    for (const source of sources) {
      workspaces[source.workspace.path] = source.workspace
      // No way to checkout non-`HEAD` ref if there is no `.git` dir
      if (source.workspace.ref !== HEAD && !source.workspace.gitDir.present) {
        const error = new Error("Fadroma Build: could not find Git directory for source.")
        throw Object.assign(error, { source })
      }
    }
    // Here we will collect the build outputs
    const artifacts:  Artifact[] = []
    // Get the distinct workspaces and refs by which to group the crate builds
    const workspaceRoots: string[] = distinct(sources.map(source=>source.workspace.path))
    const refs:           string[] = distinct(sources.map(source=>source.workspace.ref))
    // For each workspace,
    for (const path of workspaceRoots) {
      const { gitDir } = workspaces[path]
      // And for each ref of that workspace,
      for (const ref of refs) {
        let mounted = $(path)
        //console.info(
          //`Building contracts from workspace:`, bold(`${mounted.shortPath}/`),
          //`@`, bold(ref)
        //)
        if (ref !== HEAD) {
          mounted = gitDir.rootRepo
          //console.info(`Using history from Git directory: `, bold(`${mounted.shortPath}/`))
          await simpleGit(gitDir.path)
            .fetch(process.env.FADROMA_PREFERRED_REMOTE || 'origin')
        }
        // Create a list of sources for the container to build,
        // along with their indices in the input and output arrays
        // of this function.
        const crates: [number, string][] = []
        for (let index = 0; index < sources.length; index++) {
          const source = sources[index]
          if (source.workspace.path === path && source.workspace.ref === ref) {
            crates.push([index, source.crate])
          }
        }
        // Build the crates from the same workspace/ref
        // sequentially in the same container.
        const buildArtifacts = await this.runBuildContainer(
          mounted.path,
          mounted.relative(path),
          ref,
          crates,
          gitDir.isSubmodule ? gitDir.submoduleDir : ''
        )
        // Collect the artifacts built by the container
        for (const index in buildArtifacts) {
          const artifact = buildArtifacts[index]
          if (artifact) {
            artifacts[index] = artifact
          }
        }
      }
    }
    return artifacts
  }
  protected async runBuildContainer (
    root:      string,
    subdir:    string,
    ref:       string,
    crates:    [number, string][],
    gitSubdir: string = '',
    outputDir: string = $(root, subdir, this.outputDirName).path,
  ): Promise<(Artifact|null)[]> {
    // Create output directory as user if it does not exist
    $(outputDir).as(OpaqueDirectory).make()
    // Output slots. Indices should correspond to those of the input to buildMany
    const artifacts:   (Artifact|null)[] = crates.map(()=>null)
    // Whether any crates should be built, and at what indices they are in the input and output.
    const shouldBuild: Record<string, number> = {}
    // Collect cached artifacts. If any are missing from the cache mark them as buildable.
    for (const [index, crate] of crates) {
      const prebuilt = this.prebuild(outputDir, crate, ref)
      if (prebuilt) {
        const location = $(prebuilt.url).shortPath
        //console.info('Exists, not rebuilding:', bold($(location).shortPath))
        artifacts[index] = prebuilt
      } else {
        shouldBuild[crate] = index
      }
    }
    // If there are no artifacts to build, this means everything was cached and we're done.
    if (Object.keys(shouldBuild).length === 0) {
      return artifacts
    }
    // Define the mounts and environment variables of the build container
    const buildScript   = `/${basename(this.script)}`
    const safeRef       = sanitize(ref)
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
      [process.env.SSH_AUTH_SOCK]: '/ssh_agent_socket'
    }
    const writable = {
      // Output path for final artifacts
      [outputDir]:                  `/output`,
      // Persist cache to make future rebuilds faster. May be unneccessary.
      [`project_cache_${safeRef}`]: `/tmp/target`,
      [`cargo_cache_${safeRef}`]:   `/usr/local/cargo`
    }
    // Since Fadroma can be included as a Git submodule, but
    // Cargo doesn't support nested workspaces, Fadroma's
    // workpace root manifest is renamed to _Cargo.toml.
    // Here we can mount it under its proper name
    // if building the example contracts from Fadroma.
    if (process.env.FADROMA_BUILD_WORKSPACE_MANIFEST) {
      if (ref !== HEAD) {
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
      _BUILD_USER:                   process.env.FADROMA_BUILD_USER || 'fadroma-builder',
      _BUILD_UID:                    process.env.FADROMA_BUILD_UID  || process.getuid(),
      _BUILD_GID:                    process.env.FADROMA_BUILD_GID  || process.getgid(),
      _GIT_REMOTE:                   process.env.FADROMA_PREFERRED_REMOTE||'origin',
      _GIT_SUBDIR:                   gitSubdir,
      _SUBDIR:                       subdir,
      CARGO_HTTP_TIMEOUT:           '240',
      CARGO_NET_GIT_FETCH_WITH_CLI: 'true',
      GIT_PAGER:                    'cat',
      GIT_TERMINAL_PROMPT:          '0',
      LOCKED:                       '',/*'--locked'*/
      SSH_AUTH_SOCK:                '/ssh_agent_socket',
      TERM:                         process.env.TERM,
    }
    // Pre-populate the list of expected artifacts.
    const outputWasms = [...new Array(crates.length)].map(()=>null)
    for (const [crate, index] of Object.entries(shouldBuild)) {
      outputWasms[index] = $(outputDir, artifactName(crate, safeRef)).path
    }
    // Pass the compacted list of crates to build into the container
    const cratesToBuild = Object.keys(shouldBuild)
    const command = ['node', buildScript, 'phase1', ref, ...cratesToBuild]
    const options = {
      remove: true,
      readonly,
      writable,
      env,
      extra: {
        Tty:         true,
        AttachStdin: true,
      }
    }
    console.info('Building with command:', bold(command.join(' ')))
    console.debug('Building in a container with this configuration:', options)
    // Prepare the log output stream
    const buildLogPrefix = `[${ref}]`.padEnd(16)
    const logs = new LineTransformStream(line=>`[Fadroma Build] ${buildLogPrefix} ${line}`)
    logs.pipe(process.stdout)
    // Run the build container
    const rootName       = sanitize(basename(root))
    const buildName      = `fadroma-build-${rootName}@${ref}`
    const buildContainer = await this.image.run(buildName, options, command, '/usr/bin/env', logs)
    const {Error: err, StatusCode: code} = await buildContainer.wait()
    // Throw error if launching the container failed
    if (err) {
      throw new Error(`[@fadroma/ops/Build] Docker error: ${err}`)
    }
    // Throw error if the build failed
    if (code !== 0) {
      const crateList = cratesToBuild.join(' ')
      console.error(
        'Build of crates:',   bold(crateList),
        'exited with status', bold(code)
      )
      throw new Error(
        `[@fadroma/ops/Build] Build of crates: "${crateList}" exited with status ${code}`
      )
    }
    // Return a sparse array of the resulting artifacts
    return outputWasms.map(location => {
      if (location === null) {
        return null
      } else {
        return new Artifact($(location).url, codeHashForPath(location))
      }
    })
  }
}

export interface RawBuilderOptions {
  caching:    boolean
  script:     string
  noFetch?:   boolean
  toolchain?: string
}

/** This build mode looks for a Rust toolchain in the same environment
  * as the one in which the script is running, i.e. no build container. */
export class RawBuilder extends CachingBuilder {
  constructor ({ caching, script, noFetch, toolchain = '1.59' }: RawBuilderOptions) {
    super({ caching })
    this.script    = $(script)
    this.noFetch   = noFetch
    this.toolchain = toolchain
  }
  script:    Path
  noFetch:   boolean|undefined
  toolchain: string
  /** Build a Source into an Artifact */
  async build (source: Source): Promise<Artifact> {
    return (await this.buildMany([source]))[0]
  }
  /** This implementation groups the passed source by workspace and ref,
    * in order to launch one build container per workspace/ref combination
    * and have it build all the crates from that combination in sequence,
    * reusing the container's internal intermediate build cache. */
  async buildMany (sources: Source[]): Promise<Artifact[]> {
    const artifacts = []
    for (const source of sources) {
      let cwd = source.workspace.path
      // Temporary dirs used for checkouts of non-HEAD builds
      let tmpGit, tmpBuild
      // Most of the parameters are passed to the build script
      // by way of environment variables.
      const env = {
        _BUILD_GID: process.getgid(),
        _BUILD_UID: process.getuid(),
        _OUTPUT:    $(source.workspace.path).in('artifacts').path,
        _REGISTRY:  '',
        _TOOLCHAIN: this.toolchain,
      }
      if ((source.workspace.ref ?? HEAD) !== HEAD) {
        // Provide the build script with the config values that ar
        // needed to make a temporary checkout of another commit
        if (!source.workspace.gitDir?.present) {
          const error = new Error("Fadroma Build: could not find Git directory for source.")
          throw Object.assign(error, { source })
        }
        // Create a temporary Git directory. The build script will copy the Git history
        // and modify the refs in order to be able to do a fresh checkout with submodules
        const { gitDir } = source.workspace
        tmpGit   = $(mkdtempSync($(tmpdir(), 'fadroma-git-').path))
        tmpBuild = $(mkdtempSync($(tmpdir(), 'fadroma-build-').path))
        Object.assign(env, {
          _GIT_ROOT:   gitDir.path,
          _GIT_SUBDIR: gitDir.isSubmodule ? gitDir.submoduleDir : '',
          _NO_FETCH:   this.noFetch,
          _TMP_BUILD:  tmpBuild.path,
          _TMP_GIT:    tmpGit.path,
        })
      }
      // Run the build script
      const cmd = [
        process.argv[0],
        this.script.path,
        'phase1',
        source.workspace.ref,
        source.crate
      ]
      const opts = { cwd, env: { ...process.env, ...env }, stdio: 'inherit' }
      //console.log(opts)
      const sub  = spawn(cmd.shift(), cmd, opts as any)
      await new Promise<void>((resolve, reject)=>{
        sub.on('exit', (code, signal) => {
          const build = `Build of ${source.crate} from ${$(source.workspace.path).shortPath} @ ${source.workspace.ref}`
          if (code === 0) {
            resolve()
          } else if (code !== null) {
            const message = `${build} exited with code ${code}`
            console.error(message)
            throw Object.assign(new Error(message), { source, code })
          } else if (signal !== null) {
            const message = `${build} exited by signal ${signal}`
            console.warn(message)
          } else {
            throw new Error('Unreachable')
          }
        })
      })
      // Create an artifact for the build result
      const location = $(env._OUTPUT, artifactName(source.crate, sanitize(source.workspace.ref)))
      console.info('Build ok:', bold(location.shortPath))
      const codeHash = codeHashForPath(location.path)
      artifacts.push({ url: pathToFileURL(location.path), codeHash })
      // If this was a non-HEAD build, remove the temporary Git dir used to do the checkout
      if (tmpGit   && tmpGit.exists())   tmpGit.delete()
      if (tmpBuild && tmpBuild.exists()) tmpBuild.delete()
    }
    return artifacts
  }
}

/** This builder talks to a "remote" build server over HTTP.
  * "Remote" is in quotes because this implementation still expects
  * the source code and resulting artifact to be on the same filesystem,
  * i.e. this is only useful in a local docker-compose scenario. */
export class RemoteBuilder extends CachingBuilder {
  //Endpoint = Endpoint

  /** HTTP endpoint to request builds */
  //manager: Endpoint

  constructor (options: { managerURL?: string } = {}) {
    super()
    //this.manager = new this.Endpoint(options.managerURL)
  }

  /** Perform a managed build. */
  async build (source): Promise<Artifact> {
    throw 'TODO'
    // Support optional build caching
    //const prebuilt = this.prebuild(source)
    //if (prebuilt) {
      //console.info('Exists, not rebuilding:', bold(relative(cwd(), source)))
      //return prebuilt
    //}
    //// Request a build from the build manager
    //const { crate, ref = HEAD } = source
    //const { location } = await this.manager.get('/build', { crate, ref })
    //const codeHash = codeHashForPath(location)
    //return { url: pathToFileURL(location), codeHash }
  }
}

/** Run the schema generator example binary of each contract. */
export async function generateSchema (projectRoot: string, dirs: Array<string>) {
  for (const dir of dirs) {
    //console.info(`Generating schema for ${bold(dir)}`)
    // Generate JSON schema
    const cargoToml = resolve(projectRoot, 'contracts', dir, 'Cargo.toml')
    const {package:{name}} = parseToml(readFileSync(cargoToml, 'utf8'))
    execFileSync('cargo', ['run', '-p', name, '--example', 'schema'], { stdio: 'inherit' })

    // Collect generated schema definitions
    const schemaDir = resolve(projectRoot, 'contracts', dir, 'schema')
    const schemas = readdirSync(schemaDir)
      .filter(x=>x.endsWith('.json'))
      .map(x=>resolve(schemaDir, x))

    // Remove `For_HumanAddr` suffix from generic structs
    // This does a naive find'n' replace, not sure what it'll do for
    // types that are genericized over HumanAddr AND something else?
    for (const schema of schemas) {
      const content = readFileSync(schema, 'utf8')
      writeFileSync(schema, content.replace(/_for_HumanAddr/g, ''), 'utf8')
    }

    // Generate type definitions from JSON schema
    await schemaToTypes(...schemas)
  }
}

/** Convert JSON schema to TypeScript types */
export function schemaToTypes (...schemas: Array<string>) {
  return Promise.all(schemas.map(schema=>
    compileFromFile(schema).then((ts: any)=>{
      const output = `${dirname(schema)}/${basename(schema, '.json')}.d.ts`
      writeFileSync(output, ts)
      //console.info(`Generated ${output}`)
    })))
}

/** Get build settings from environment. */
export function getBuildConfig (config) {
  return {
    /** URL to the build manager endpoint, if used. */
    manager:    config.getStr( 'FADROMA_BUILD_MANAGER',    ()=>null),
    /** Whether to bypass Docker and use the toolchain from the environment. */
    raw:        config.getBool('FADROMA_BUILD_RAW',        ()=>null),
    /** Whether to ignore existing build artifacts and rebuild contracts. */
    rebuild:    config.getBool('FADROMA_REBUILD',          ()=>false),
    /** Whether not to run `git fetch` during build. */
    noFetch:    config.getBool('FADROMA_NO_FETCH',         ()=>false),
    /** Whether not to run `git fetch` during build. */
    toolchain:  config.getStr( 'FADROMA_RUST',             ()=>''),
    image:      config.getStr( 'FADROMA_BUILD_IMAGE',      ()=>DockerBuilder.image),
    dockerfile: config.getStr( 'FADROMA_BUILD_DOCKERFILE', ()=>DockerBuilder.dockerfile),
    script:     config.getStr( 'FADROMA_BUILD_SCRIPT',     ()=>DockerBuilder.script),
    service:    config.getStr( 'FADROMA_BUILD_SERVICE',    ()=>DockerBuilder.service),
  }
}

export function getBuilder ({
  rebuild,
  caching = !rebuild,
  raw,
  managerUrl,
  image,
  dockerfile,
  service,
  script,
  toolchain,
  noFetch
}: Partial<BuilderOptions> = {}) {
  if (raw) {
    return new RawBuilder({ caching, script, noFetch, toolchain })
  } else if (managerUrl) {
    throw new Error('unimplemented: managed builder will be available in a future version of Fadroma')
    //return new ManagedBuilder({ managerURL })
  } else {
    return new DockerBuilder({ caching, script, image, dockerfile, service })
  }
}

export class BuildConfig extends Environment {
}
