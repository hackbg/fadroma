import { execSync } from 'child_process'
import { resolve, dirname, sep } from 'path'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

const { argv, umask, chdir, cwd, exit } = process
const slashes = new RegExp("/", "g")
const dashes = new RegExp("-", "g")
const verbose = Boolean(env('_VERBOSE', false))
const phases = { phase1 }
const phase = argv[2]
const main = phases[phase]
main()

/** As the initial user, set up the container and the source workspace,
  * checking out an old commit if specified. Then, call phase 2 with
  * the name of each crate sequentially. */
function phase1 (options = {}) {

  let {
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
    outputDir   = env('_OUTPUT', '/output'),
    docker      = env('RUNNING_IN_DOCKER', false), // are we running in a container?
    interpreter = argv[0], // e.g. /usr/bin/node
    script      = argv[1], // this file
    ref         = argv[3], // "HEAD" | <git ref>
    crates      = argv.slice(4), // all crates to build
    user        = 'fadroma-builder',
    buildRoot   = resolve(tmpBuild, sanitize(ref)),
    gitDir      = resolve(gitRoot, gitSubdir),
    toolchain   = env('_TOOLCHAIN'),
    platform    = 'wasm32-unknown-unknown',
    locked      = '',
  } = options

  log('Build phase 1: Preparing source repository for', ref)
  setupToolchain()
  reportContext()
  prepareContext()
  prepareSource()
  buildCrates()

  function setupToolchain () {
    if (toolchain) {
      run(`rustup default ${toolchain}`)
      run(`rustup target add ${platform}`)
    }
    run(`rustup show active-toolchain`)
  }

  function reportContext () {
    // Print versions of used tools
    run(`cargo --version`)
    run(`rustc --version`)
    run(`wasm-opt --version`)
    run(`sha256sum --version | head -n1`)
    // In verbose mode, also "look around".
    if (verbose) {
      run(`pwd`)
      run(`ls -al`)
      run(`ls -al /tmp/target`)
    }
  }

  function prepareContext () {
    // The local registry is stored in a Docker volume mounted at /usr/local.
    // This makes sure it is accessible to non-root users.
    umask(0o000)
    if (buildRoot) run(`mkdir -p "${buildRoot}"`)
    if (tmpTarget) run(`mkdir -p "${tmpTarget}" && chmod -t "${tmpTarget}"`)
    if (registry)  run(`mkdir -p "${registry}"`)
    if (docker)    run(`chmod ugo+rwx /usr/local/cargo/registry`)
    umask(0o022)
  }

  function prepareSource () {
    // Copy the source into the build dir
    run(`git --version`)
    if (ref === 'HEAD') {
      log(`Building from working tree.`)
      chdir(subdir)
    } else {
      prepareHistory
    }
  }

  function prepareHistory () {
    log(`Building from checkout of ${ref}`)
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
    if (verbose) run('pwd')
    if (verbose) run('ls -al')
    log()
    // Clone submodules
    log(`Populating Git submodules...`)
    run(`git submodule update --init --recursive`)
    chdir(subdir)
  }

  function buildCrates () {
    if (crates.length < 1) {
      log('No crates to build.')
      return
    }
    log(`Building in:`, call('pwd'))
    log(`Building these crates: ${crates}`)
    run([
      `cargo build ${`-p ` + crates.join(' -p ')}`,
      `--release --target ${platform}`,
      `${locked} ${verbose?'--verbose':''}`
    ].join(' '), {
      CARGO_TARGET_DIR: tmpTarget,
      PLATFORM:         platform,
    })
    if (verbose) run(`tree ${tmpTarget}`)
    for (const crate of crates) {
      const output     = `${fumigate(crate)}.wasm`
      const releaseDir = resolve(tmpTarget, platform, 'release')
      const compiled   = resolve(releaseDir, output)
      const optimized  = resolve(outputDir, `${sanitize(crate)}@${sanitize(ref)}.wasm`)
      const checksum   = `${optimized}.sha256`
      // Output optimized build to artifacts directory
      if (verbose) run(`ls -al ${releaseDir}`)
      //run(`cp ${compiled} ${optimized}.unoptimized`)
      //run(`chmod -x ${optimized}.unoptimized`)
      if (verbose) {
        log(`WASM section headers of ${compiled}:`)
        run(`wasm-objdump -h ${compiled}`)
      }
      log(`Optimizing ${compiled} into ${optimized}...`)
      run(`wasm-opt -g -Oz --strip-dwarf ${compiled} -o ${optimized}`)
      if (verbose) {
        log(`* WASM section headers of ${optimized}:`)
        run(`wasm-objdump -h ${optimized}`)
      }
      log(`Optimization complete`)
      // Output checksum to artifacts directory
      log(`Saving checksum for ${optimized} into ${checksum}...`)
      run(`sha256sum -b ${optimized} > ${checksum}`)
      log(`Checksum calculated:`, checksum)
      run(`chown ${uid} ${optimized}`)
      run(`chown ${uid} ${checksum}`)
      run(`chgrp ${gid} ${optimized}`)
      run(`chgrp ${gid} ${checksum}`)
      log(`Permissions set to: ${uid}:${gid}`)
    }
  }

}

function log (...args) {
  return console.log("#", ...args)
}

function env (key, def) {
  let val = (key in process.env) ? process.env[key] : def
  if (val === '0')     val = 0
  if (val === 'false') val = false
  return val
}

function run (command, env2 = {}) {
  if (verbose) console.log('$', command)
  execSync(command, { env: { ...process.env, ...env2 }, stdio: 'inherit' })
}

function call (command) {
  console.log('$', command)
  const result = String(execSync(command)).trim()
  console.log('>', result)
  return result
}

function time (command) {
  const t0 = + new Date()
  run(command)
  const t1 = + new Date()
  console.log(`dT=${t1-t0}ms`)
}

function sanitize (x) {
  return x.replace(slashes, "_")
}

function fumigate (x) {
  return x.replace(dashes,  "_")
}
