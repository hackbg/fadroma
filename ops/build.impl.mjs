/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
//@ts-check
import { execSync } from 'child_process'
import { resolve, dirname, basename, sep } from 'path'
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'fs'

const { argv, umask, chdir, cwd, exit } = process
const slashes = new RegExp("/", "g")
const sanitize = x => x.replace(slashes, "_")
const dashes = new RegExp("-", "g")
const fumigate = x => x.replace(dashes, "_")
const verbose = Boolean(env('FADROMA_VERBOSE', Boolean(env('FADROMA_BUILD_VERBOSE', false))))

;(async()=>{
  await main()
})()

/** As the initial user, set up the container and the source workspace,
  * checking out an old commit if specified. Then, call phase 2 with
  * the name of each crate sequentially. */
async function main ({
  /** @type {object} build tasks to perform. */
  tasks       = JSON.parse(env('FADROMA_BUILD_TASKS', '[]')),
  /** @type {string} source reference to append to file names */
  sourceRef   = env('FADROMA_SRC_REF',    'HEAD'),
  /** @type {string} optimized output directory */
  outputDir   = env('FADROMA_OUTPUT',     '/output'),
  /** @type {boolean} whether this script is running in a container */
  docker      = env('FADROMA_IN_DOCKER',  false),
  /** @type {string|undefined} version of toolchain to use */
  toolchain   = env('FADROMA_TOOLCHAIN'),
  /** @type {string} temporary build directory. */
  tmpBuild    = env('FADROMA_TMP_BUILD',  '/tmp/fadroma-build'),
  /** @type {string} temporary build output directory. */
  tmpTarget   = env('FADROMA_TMP_TARGET', resolve(tmpBuild, 'target')),
  /** @type {string} temporary git data directory. */
  tmpGit      = env('FADROMA_TMP_GIT',    '/tmp/fadroma-git'),
  /** @type {string} cargo registry. */
  registry    = env('FADROMA_REGISTRY',   '/usr/local/cargo/registry'),
  /** @type {string} source git data directory path? */
  gitRoot     = env('FADROMA_GIT_ROOT',   `/src/.git`),
  /** @type {string} source git remote? */
  gitRemote   = env('FADROMA_GIT_REMOTE', 'origin'),
  /** @type {string} don't run git fetch? */
  noFetch     = env('FADROMA_NO_FETCH',   false),
  /** @type {string|number} uid to set on built files? */
  uid         = env('FADROMA_BUILD_UID',  process.getuid()),
  /** @type {string|number} gid to set on built files? */
  gid         = env('FADROMA_BUILD_GID',  process.getgid()),
  /** @type {string} temporary build directory? */
  buildRoot   = resolve(tmpBuild, sanitize(sourceRef)),
  /** @type {'wasm32-unknown-unknown'} compilation target */
  platform    = 'wasm32-unknown-unknown',
  /** @type {'--locked'|''} */
  locked      = '',
} = {}) {
  const context = {
    git:         tool(`git --version`),
    rustup:      tool(`rustup --version`),
    cargo:       tool(`cargo --version`),
    rustc:       tool(`rustc --version`),
    wasmOpt:     tool(`wasm-opt --version`),
    wasmObjdump: tool(`wasm-objdump --version`),
    sha256Sum:   tool(`sha256sum --version | head -n1`),
  }
  if (toolchain) {
    if (!context.rustup) throw new Error("please install rustup")
    run(`rustup default ${toolchain}`)
    run(`rustup target add ${platform}`)
  }
  if (verbose && context.rustup) {
    run(`rustup show active-toolchain`)
  }
  // The local Cargo registry is stored in a Docker volume mounted at /usr/local.
  // This makes sure it is accessible to non-root users.:
  umask(0o000)
  if (buildRoot) {
    run(`mkdir -p "${buildRoot}"`)
  }
  if (tmpTarget) {
    run(`mkdir -p "${tmpTarget}" && chmod -t "${tmpTarget}"`)
  }
  //if (registry) {
    //run(`mkdir -p "${registry}"`)
  //}
  //if (docker) {
    //run(`chmod ugo+rwx /usr/local/cargo/registry`)
  //}
  umask(0o022)
  if (sourceRef === 'HEAD') {
    log(`Compiling from working tree.`)
  } else {
    warn(`Historical builds currently disabled.`)
    exit(1)
  }
  for (const task of tasks) {
    if (task.cargoWorkspace) {
      compileWorkspace(task)
      for (const cargoCrate of task.cargoCrates) {
        optimizeCrate(cargoCrate)
      }
    } else if (task.cargoToml) {
      compileCrate(task)
      optimizeCrate(task.cargoCrate)
    } else {
      throw new Error("unsupported build task")
    }
  }
  function compileWorkspace ({ cargoWorkspace, cargoCrates }) {
    log(`Compiling crates ${cargoCrates.join(', ')} from workspace ${cargoWorkspace}`)
    run([
      `cargo build --release`,
      `--manifest-path ${cargoWorkspace}`,
      `--target ${platform}`,
      `${locked} ${verbose?'--verbose':''}`,
      ...cargoCrates.map(crate=>`-p ${crate}`)
    ].join(' '), {
      CARGO_TARGET_DIR: tmpTarget,
      PLATFORM: platform,
    })
  }
  function compileCrate ({ cargoToml, cargoCrate }) {
    log(`Compiling crate ${cargoCrate} from ${cargoToml}`)
    run([
      `cargo build --release`,
      `--manifest-path ${cargoToml}`,
      `--target ${platform}`,
      `${locked} ${verbose?'--verbose':''}`,
    ].join(' '), {
      CARGO_TARGET_DIR: tmpTarget,
      PLATFORM: platform,
    })
    lookAround(resolve(tmpTarget, platform, 'release'))
  }
  function optimizeCrate (crateName) {
    const output = `${fumigate(crateName)}.wasm`
    const releaseDir = resolve(tmpTarget, platform, 'release')
    const compiled = resolve(releaseDir, output)
    if (verbose) {
      if (context.wasmObjdump) {
        log(`wasm section headers of ${compiled}:`)
        run(`wasm-objdump -h ${compiled}`)
      } else {
        warn(`install wabt to view wasm section headers of ${compiled}`)
      }
    }
    const optimized = resolve(outputDir, `${sanitize(crateName)}@${sanitize(sourceRef)}.wasm`)
    const checksum = `${optimized}.sha256`
    if (context.wasmOpt) {
      debug(`Optimizing ${compiled} into ${optimized}...`)
      run(`wasm-opt -g -Oz --strip-dwarf ${compiled} -o ${optimized}`)
      if (verbose) {
        if (context.wasmObjdump) {
          log(`wasm section headers of ${optimized}:`)
          run(`wasm-objdump -h ${optimized}`)
        } else {
          warn('please install wabt')
        }
      }
      debug(`Optimized ${compiled} into ${optimized}...`)
    } else {
      warn('install wasm-opt to automatically optimize your release builds')
      debug(`renaming ${compiled} to ${optimized}...`)
      run(`cp ${compiled} ${optimized}`)
    }
    // Output checksum to artifacts directory
    debug(`Saving checksum for ${optimized} into ${checksum}...`)
    const cwd = process.cwd()
    chdir(dirname(optimized))
    run(`sha256sum -b ${basename(optimized)} > ${checksum}`)
    chdir(cwd)
    chown(optimized, uid, gid)
    chown(checksum, uid, gid)
    console.log()
    console.log(`${readFileSync(checksum, 'utf8').trim()}`)
    console.log(`  Compiled: ${statSync(compiled).size} bytes`)
    console.log(`  Optimized: ${statSync(optimized).size} bytes`)
  }

}

function chown (path, uid, gid) {
  try {
    run(`chown ${uid} ${path}`)
    debug(`owner of ${path} set to ${uid}`)
  } catch (e) {
    log(`!!! setting owner of ${path} to ${uid} failed:`, e)
  }
  try {
    run(`chgrp ${gid} ${path}`)
    debug(`group of ${path} set to ${gid}`)
  } catch (e) {
    log(`!!! setting group of ${path} to ${gid} failed:`, e)
  }
}

function debug (...args) {
  if (verbose) return console.log(" #", ...args)
}

function log (...args) {
  return console.log(" #", ...args)
}

function warn (...args) {
  return console.warn(" !", ...args)
}

function env (key, def) {
  let val = (key in process.env) ? process.env[key] : def
  if (val === '0')     val = 0
  if (val === 'false') val = false
  return val
}

function run (command, env2 = {}) {
  if (verbose) console.log('>', command)
  return execSync(command, { env: { ...process.env, ...env2 }, stdio: 'inherit' })
}

function git (command, ...args) {
  return run(`git --no-paged ${command}`, ...args)
}

function call (command) {
  console.log(' >', command)
  const result = String(execSync(command)).trim()
  console.log(' <', result)
  return result
}

function time (command) {
  const t0 = + new Date()
  run(command)
  const t1 = + new Date()
  console.log(`dT=${t1-t0}ms`)
}


function tool (command) {
  let version = null
  try {
    version = String(execSync(command)).trim()
    console.log(' *', version)
  } catch (e) {
    console.log(` !`, `not found: ${command}`)
  } finally {
    return version
  }
}

function tools () {
  return 
}

function lookAround (path = process.cwd()) {
  debug(`files in ${path}: ${readdirSync(path).join(' ')}`)
}
