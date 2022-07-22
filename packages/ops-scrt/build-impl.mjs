import { execSync } from 'child_process'
import { resolve, dirname, sep } from 'path'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

const { env, argv, umask, chdir, cwd, exit } = process

const slashes  = new RegExp("/", "g")
const dashes   = new RegExp("-", "g")
const sanitize = x => x.replace(slashes, "_")
const fumigate = x => x.replace(dashes,  "_")

const run = (command, env2 = {}) => {
  console.info('$', command)
  execSync(command, { env: { ...env, ...env2 }, stdio: 'inherit' })
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
  docker      = env.RUNNING_IN_DOCKER || false, // are we running in a container?
  interpreter = argv[0],       // e.g. /usr/bin/node
  script      = argv[1],       // this file
  ref         = argv[3],       // "HEAD" | <git ref>
  crates      = argv.slice(4), // all crates to build
  buildRoot   = resolve('/tmp/fadroma-build', sanitize(ref)),
  subdir      = env.SUBDIR      || '.',
  gitRoot     = `/src/.git`,
  gitSubdir   = env.GIT_SUBDIR  || '',
  gitDir      = resolve(gitRoot, gitSubdir),
  gitRemote   = env.GIT_REMOTE  || 'origin',
  uid         = env.BUILD_UID   || 1000,
  gid         = env.BUILD_GID   || 1000,
  user        = 'fadroma-builder',
} = {}) {

  console.log('Build phase 1: Preparing source repository for', ref)

  // Create a non-root build user if one doesn't exist
  try {
    user = call(`id -un ${uid}`)
  } catch (e) {
    run(`groupadd -g${gid} ${user} || true`)
    run(`useradd -m -g${gid} -u${uid} ${user}`)
  }

  // The local registry is stored in a Docker volume mounted at /usr/local.
  // This makes sure it is accessible to non-root users.
  umask(0o000)
  run(`mkdir -p "${buildRoot}" /tmp/target /usr/local/cargo/registry`)
  if (docker) {
    run(`chmod ugo+rwx /usr/local/cargo/registry`)
  }
  umask(0o022)

  // Copy the source into the build dir
  run(`git --version`)
  if (ref === 'HEAD') {
    console.log(`Building from working tree.`)
    chdir(subdir)
  } else {
    console.log(`Building from checkout of ${ref}`)
    // This works by using ".git" (or ".git/modules/something") as a remote
    // and cloning from it. Since we may need to modify that directory,
    // we'll make a copy. This may be slow if ".git" is huge
    // (but at least it's not the entire working tree with node_modules etc)
    time(`cp -r ${gitRoot} /tmp/git`)
    gitRoot = '/tmp/git'
    gitDir  = `${gitRoot}/${gitSubdir}`
    // Helper functions to run with ".git" in a non-default location.
    const gitRun  = command => run(`GIT_DIR=${gitDir} git ${command}`)
    const gitCall = command => call(`GIT_DIR=${gitDir} git ${command}`)
    // Make this a bare checkout by removing the path to the working tree from the config.
    // We can't use "config --local --unset core.worktree" - since the working tree path
    // does not exist, git command invocations fail with "no such file or directory".
    const gitConfigPath = `${gitDir}/config`
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
      try {
        console.log(`${ref} is not checked out. Creating branch ref from ${gitRemote}/${ref}.`)
        const shown     = gitCall(`show-ref --verify refs/remotes/${gitRemote}/${ref}`)
        const remoteRef = shown.split(' ')[0]
        const refPath   = resolve(`${gitDir}/refs/heads/`, ref)
        mkdirSync(dirname(refPath), { recursive: true })
        writeFileSync(refPath, remoteRef, 'utf8')
        gitRun(`show-ref --verify --quiet refs/heads/${ref}`)
      } catch (e) {
        console.log(e)
        console.log(`${ref} is not checked out or fetched. Run "git fetch" to update.`)
        exit(1)
      }
    }

    // Clone from the temporary local remote into the temporary working tree
    run(`git clone -b ${ref} ${gitDir} ${buildRoot}`)
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

  // Switch to build user and run phase 2 for each requested crate
  console.log(`Building in:`, call('pwd'))
  console.log(`Build phase 2 will begin with these crates: ${crates}`)
  for (const crate of crates) {
    console.log(`Building ${crate} from ${ref} in ${cwd()}`)
    run(`su ${user} -c "${interpreter} ${script} phase2 ${ref} ${crate}"`)
  }

}

/** As a non-root user, execute a release build, then optimize it with Binaryen. */
function phase2 ({
  ref       = argv[3], // "HEAD" | <git ref>
  crate     = argv[4], // one crate to build
  targetDir = '/tmp/target',
  platform  = 'wasm32-unknown-unknown',
  rustFlags = '-C link-arg=-s',
  locked    = '',
  output    = `${fumigate(crate)}.wasm`,
  compiled  = resolve(targetDir, platform, 'release', output),
  optimized = resolve('/output', `${sanitize(crate)}@${sanitize(ref)}.wasm`),
  checksum  = `${optimized}.sha256`,
} = {}) {

  console.log(`Build phase 2: Compiling and optimizing contract: ${crate}@${ref}.wasm`)

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
