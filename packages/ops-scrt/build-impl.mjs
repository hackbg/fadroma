import { execSync } from 'child_process'

const slashes  = new RegExp("/", "g")
const dashes   = new RegExp("-", "g")
const sanitize = x => x.replace(slashes, "_")
const fumigate = x => x.replace(dashes,  "_")

const run = (command, env) => {
  console.info('$', command)
  execSync(command, { env: { ...process.env, ...env }, stdio: 'inherit' })
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
  workspace   = '/src',
  temp        = `/tmp/fadroma-build-${sanitize(ref)}`,
  buildDir    = `${temp}/${sanitize(ref)}`,
  uid         = process.env.USER  || 1000,
  gid         = process.env.GROUP || 1000,

} = {}) {
  console.log('Build phase 1: Preparing source repository for', ref)

  // Create a non-root build user.
  run(`groupadd -g${gid} ${gid} || true`)
  run(`useradd -m -g${gid} -u${uid} build || true`)

  // The local registry is stored in a Docker volume mounted at /usr/local.
  // This makes sure it is accessible to non-root users.
  process.umask(0o000)
  run(`mkdir -p "${buildDir}" /tmp/target /usr/local/cargo/registry`)
  process.umask(0o022)
  run(`chown -R ${uid} /usr/local/cargo/registry`)
  run(`chown -R ${uid} /src`)
  run(`chown ${uid} /output`)

  // Copy the source into the build dir
  run(`git --version`)
  console.log(`Cleaning untracked files...`)
  run(`cp -rT ${workspace} ${buildDir}`)
  process.chdir(buildDir)
  if (ref === 'HEAD') {
    console.log(`Building from working tree...`)
  } else {
    run(`git stash -u`)
    run(`git reset --hard --recurse-submodules`)
    run(`git clean -f -d -x`)
    console.log(`Checking out ${ref} in ${buildDir}`)
    run(`git checkout "${ref}"`)
    console.log(`Preparing submodules...`)
    run(`git submodule update --init --recursive`)
    run(`git log -1`)
    console.log()
  }
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
  targetDir = '/tmp/target',
  platform  = 'wasm32-unknown-unknown',
  rustFlags = '-C link-arg=-s',
  locked    = '',
  output    = `${fumigate(crate)}.wasm`,
  compiled  = `${targetDir}/${platform}/release/${output}`,
  optimized = `${workspace}/artifacts/${sanitize(crate)}@${sanitize(ref)}.wasm`,
  checksum  = `${optimized}.sha256`,
} = {}) {
  console.log(`Build phase 2: Compiling and optimizing contract: ${crate}@${ref}.wasm`)
  run(`cargo --version`)
  run(`rustc --version`)
  run(`wasm-opt --version`)
  run(`sha256sum --version | head -n1`)
  run(`cargo build -p ${crate} --release --target ${platform} ${locked} --verbose`, {
    RUSTFLAGS:        rustFlags,
    CARGO_TARGET_DIR: targetDir,
    PLATFORM:         platform,
  })
  console.log(`Build complete.`)
  console.log(`Optimizing ${compiled} into ${optimized}...`)
  run(`wasm-opt -Oz ${compiled} -o ${optimized}`)
  console.log(`Optimization complete`)
  console.log(`Saving checksum for ${optimized} into ${checksum}...`)
  run(`sha256sum -b ${optimized} > ${checksum}`)
  console.log(`Checksum calculated:`, checksum)
}
