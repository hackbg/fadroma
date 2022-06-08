import { execSync } from 'child_process'
import { resolve, dirname, sep } from 'path'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'

const slashes  = new RegExp("/", "g")
const dashes   = new RegExp("-", "g")
const sanitize = x => x.replace(slashes, "_")
const fumigate = x => x.replace(dashes,  "_")

const run = (command, env) => {
  console.info('$', command)
  execSync(command, { env: { ...process.env, ...env }, stdio: 'inherit' })
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
const phase  = process.argv[2]
phases[phase]()

/** As the initial user, set up the container and the source workspace,
  * checking out an old commit if specified. Then, call phase 2 with
  * the name of each crate sequentially. */
function phase1 ({
  interpreter = process.argv[0],       // e.g. /usr/bin/node
  script      = process.argv[1],       // this file
  ref         = process.argv[3],       // "HEAD" | <git ref>
  crates      = process.argv.slice(4), // all crates to build
  buildRoot   = `/tmp/fadroma-build/${sanitize(ref)}`,
  subdir      = process.env.SUBDIR || '.',
  gitRoot     = `/src/.git`,
  gitSubdir   = process.env.GIT_SUBDIR || '',
  gitDir      = `${gitRoot}/${gitSubdir}`,
  gitRemote   = process.env.REMOTE || 'origin',
  uid         = process.env.USER   || 1000,
  gid         = process.env.GROUP  || 1000,
} = {}) {

  console.log('Build phase 1: Preparing source repository for', ref)

  // Create a non-root build user.
  run(`groupadd -g${gid} ${gid} || true`)
  run(`useradd -m -g${gid} -u${uid} build || true`)

  // The local registry is stored in a Docker volume mounted at /usr/local.
  // This makes sure it is accessible to non-root users.
  process.umask(0o000)
  run(`mkdir -p "${buildRoot}" /tmp/target /usr/local/cargo/registry`)
  process.umask(0o022)
  run(`chown -R ${uid} /usr/local/cargo/registry`)
  run(`chown -R ${uid} /src`)
  run(`chown ${uid} /output`)

  // Copy the source into the build dir
  run(`git --version`)
  if (ref === 'HEAD') {
    console.log(`Building from working tree.`)
    process.chdir(subdir)
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
    console.log({gitDir})
    run(`cat ${gitDir}/config`)
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
        process.exit(1)
      }
    }
    run(`git clone -b ${ref} ${gitDir} ${buildRoot}`)
    process.chdir(buildRoot)
    run('ls -al')
    run('git branch')
    run('git branch -r')
    run(`git checkout ${ref}`)
    run(`git log -1`)
    console.log()
    console.log(`Populating Git submodules...`)
    run(`git submodule update --init --recursive`)
    process.chdir(subdir)
  }

  // Build the prepared source
  console.log(`Building in:`)
  run(`pwd`)
  console.log(`Build phase 2 will begin with these crates: ${crates}`)
  for (const crate of crates) {
    console.log(`Building ${crate} from ${ref} in ${process.cwd()}`)
    run(`su build -c "${interpreter} ${script} phase2 ${ref} ${crate}"`)
  }

}

/** As a non-root user, execute a release build, then optimize it with Binaryen. */
function phase2 ({
  ref       = process.argv[3], // "HEAD" | <git ref>
  crate     = process.argv[4], // one crate to build
  workspace = '/src',
  subdir    = process.env.SUBDIR || '',
  targetDir = '/tmp/target',
  platform  = 'wasm32-unknown-unknown',
  rustFlags = '-C link-arg=-s',
  locked    = '',
  output    = `${fumigate(crate)}.wasm`,
  compiled  = `${targetDir}/${platform}/release/${output}`,
  optimized = resolve(workspace, subdir, 'artifacts', `${sanitize(crate)}@${sanitize(ref)}.wasm`),
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
