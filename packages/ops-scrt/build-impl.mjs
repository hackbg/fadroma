import { execSync } from 'child_process'
import { resolve, dirname, sep } from 'path'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

const { argv, umask, chdir, cwd, exit } = process
const env = (key, def) => {
  let val = (key in process.env) ? process.env[key] : def
  if (val === '0')     val = 0
  if (val === 'false') val = false
  return val
}

const slashes  = new RegExp("/", "g")
const dashes   = new RegExp("-", "g")
const sanitize = x => x.replace(slashes, "_")
const fumigate = x => x.replace(dashes,  "_")

const run = (command, env2 = {}) => {
  console.info('$', command)
  execSync(command, { env: { ...process.env, ...env2 }, stdio: 'inherit' })
}

const call = command => {
  console.info('$', command)
  const result = String(execSync(command)).trim()
  console.info(result)
  return result
}

const time = (command) => {
  const t0 = + new Date()
  run(command)
  const t1 = + new Date()
  console.log(`(took ${t1-t0}ms)`)
}

const phases = { phase1, phase2 }
const phase  = argv[2]
phases[phase]()

/** As the initial user, set up the container and the source workspace,
  * checking out an old commit if specified. Then, call phase 2 with
  * the name of each crate sequentially. */
function phase1 ({
  tmpBuild    = env('_TMP_BUILD',  '/tmp/fadroma-build'),
  tmpTarget   = env('_TMP_TARGET', '/tmp/target'),
  tmpGit      = env('_TMP_GIT',    '/tmp/git'),
  registry    = env('_REGISTRY',   '/usr/local/cargo/registry'),
  subdir      = env('_SUBDIR',     '.') || '.',
  gitRoot     = env('_GIT_ROOT',   `/src/.git`),
  gitSubdir   = env('_GIT_SUBDIR', ''),
  gitRemote   = env('_GIT_REMOTE', 'origin'),
  uid         = env('_BUILD_UID',  1000),
  gid         = env('_BUILD_GID',  1000),
  noFetch     = env('_NO_FETCH',   false),
  interpreter = argv[0],       // e.g. /usr/bin/node
  script      = argv[1],       // this file
  ref         = argv[3],       // "HEAD" | <git ref>
  crates      = argv.slice(4), // all crates to build
  user        = 'fadroma-builder',
  buildRoot   = resolve(tmpBuild, sanitize(ref)),
  gitDir      = resolve(gitRoot, gitSubdir),
} = {}) {

  console.log('Build phase 1: Preparing source repository for', ref)

  // When running in a container, we must create a non-root build user
  // whose uid/gid corresponds to the user outside the container.
  // This is so that the permissions of the files output by the container
  // match the ones expected if the build was being run without container
  // (and the build artifacts don't end up e.g. root-owned)
  try {
    user = call(`id -un ${uid}`)
  } catch (e) {
    run(`groupadd -g${gid} ${user} || true`)
    run(`useradd -m -g${gid} -u${uid} ${user}`)
  }

  // The local registry is stored in a Docker volume mounted at /usr/local.
  // This makes sure it is accessible to non-root users.
  umask(0o000)
  if (buildRoot) run(`mkdir -p "${buildRoot}"`)
  if (tmpTarget) run(`mkdir -p "${tmpTarget}"`)
  if (registry)  run(`mkdir -p "${registry}"`)
  umask(0o022)

  // Copy the source into the build dir
  run(`git --version`)
  if (ref === 'HEAD') {
    console.log(`Building from working tree.`)
    chdir(subdir)
  } else {
    console.log(`Building from checkout of ${ref}`)
    if (!noFetch) {
      run(`git fetch --recurse-submodules origin ${ref}`)
      run('pwd')
    }
    // This works by using ".git" (or ".git/modules/something") as a remote
    // and cloning from it. Since we may need to modify that directory,
    // we'll make a copy. This may be slow if ".git" is huge
    // (but at least it's not the entire working tree with node_modules etc)
    time(`cp -rT "${gitRoot}" "${tmpGit}"`)
    gitRoot = tmpGit
    gitDir  = resolve(gitRoot, gitSubdir)
    // Helper functions to run with ".git" in a non-default location.
    const gitRun  = command => run(`GIT_DIR=${gitDir} git ${command}`)
    const gitCall = command => call(`GIT_DIR=${gitDir} git ${command}`)
    // Make this a bare checkout by removing the path to the working tree from the config.
    // We can't use "config --local --unset core.worktree" - since the working tree path
    // does not exist, git command invocations fail with "no such file or directory".
    const gitConfigPath = resolve(gitDir, 'config')
    let gitConfig = readFileSync(gitConfigPath, 'utf8')
    gitConfig = gitConfig.replace(/\s+worktree.*/g, '')
    writeFileSync(gitConfigPath, gitConfig, 'utf8')
    try {
      // Make sure that .refs/heads/${ref} exists in the git history dir,
      // (it will exist if the branch has been previously checked out).
      // This is necessary to be able to clone that branch from the history dir -
      // "git clone" only looks in the repo's refs, not the repo's remotes' refs
      gitRun(`show-ref --verify --quiet refs/heads/${ref}`)
    } catch (e) {
      // If the branch is not checked out, but is fetched, do a "fake checkout":
      // create a ref under refs/heads pointing to that branch.
      if (noFetch) {
        console.error(`${ref} is not checked out or fetched. Run "git fetch" to update.`)
        exit(1)
      } else {
        try {
          console.warn(`\n${ref} is not checked out. Creating branch ref from ${gitRemote}/${ref}\n.`)
          gitRun(`fetch origin --recurse-submodules ${ref}`)
        } catch (e) {
          console.warn(`${ref}: failed to fetch: ${e.message}`)
        }
        const shown     = gitCall(`show-ref --verify refs/remotes/${gitRemote}/${ref}`)
        const remoteRef = shown.split(' ')[0]
        const refPath   = resolve(`${gitDir}/refs/heads/`, ref)
        mkdirSync(dirname(refPath), { recursive: true })
        writeFileSync(refPath, remoteRef, 'utf8')
        gitRun(`show-ref --verify --quiet refs/heads/${ref}`)
      }
    }

    // Clone from the temporary local remote into the temporary working tree
    run(`git clone --recursive -b ${ref} ${gitDir} ${buildRoot}`)
    chdir(buildRoot)

    // Report which commit we're building and what it looks like
    run(`git log -1`)
    run('ls -al')
    console.log()

    // Clone submodules
    console.log(`Populating Git submodules...`)
    run(`git submodule update --init --recursive`)
    chdir(subdir)
  }

  // Run phase 2 for each requested crate.
  // If not running as build user, switch to build user for each run of phase2.
  console.log(`Building in:`, call('pwd'))
  console.log(`Build phase 2 will begin with these crates: ${crates}`)
  for (const crate of crates) {
    console.log(`Building ${crate} from ${ref} in ${cwd()}`)
    let phase2Command = `${interpreter} ${script} phase2 ${ref} ${crate}`
    if (process.getuid() != uid) {
      phase2Command = `su ${user} -c "${phase2Command}"`
    }
    run(phase2Command)
  }

}

/** As a non-root user, execute a release build, then optimize it with Binaryen. */
function phase2 ({
  toolchain = env('_TOOLCHAIN'),
  targetDir = env('_TMP_TARGET', '/tmp/target'),
  ref       = argv[3], // "HEAD" | <git ref>
  crate     = argv[4], // one crate to build
  platform  = 'wasm32-unknown-unknown',
  rustFlags = '-C link-arg=-s',
  locked    = '',
  output    = `${fumigate(crate)}.wasm`,
  compiled  = resolve(targetDir, platform, 'release', output),
  outputDir = env('_OUTPUT', '/output'),
  optimized = resolve(outputDir, `${sanitize(crate)}@${sanitize(ref)}.wasm`),
  checksum  = `${optimized}.sha256`,
} = {}) {

  console.log(`Build phase 2: Compiling and optimizing contract: ${crate}@${ref}.wasm`)

  if (toolchain) {
    run(`rustup default ${toolchain}`)
  }

  // Print versions of used tools
  run(`cargo --version`)
  run(`rustc --version`)
  run(`wasm-opt --version`)
  run(`sha256sum --version | head -n1`)

  // Compile crate for production
  run(`cargo build -p ${crate} --release --target ${platform} ${locked} --verbose`, {
    RUSTFLAGS:        rustFlags,
    CARGO_TARGET_DIR: targetDir,
    PLATFORM:         platform,
  })
  console.log(`Build complete.`)

  // Output optimized build to artifacts directory
  console.log(`Optimizing ${compiled} into ${optimized}...`)
  run(`wasm-opt -Oz ${compiled} -o ${optimized}`)
  console.log(`Optimization complete`)

  // Output checksum to artifacts directory
  console.log(`Saving checksum for ${optimized} into ${checksum}...`)
  run(`sha256sum -b ${optimized} > ${checksum}`)
  console.log(`Checksum calculated:`, checksum)

}
