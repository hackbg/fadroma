import {
  Source, Scrt_1_2,
  Console, bold,
  resolve, relative, basename, dirname, cwd,
  statSync, readFileSync,
  TOML
} from '../index'

const console = Console('fadroma build')
let [buildManifest,...buildArgs] = process.argv.slice(2)

buildManifest = resolve(buildManifest)
if (statSync(buildManifest).isDirectory()) {
  buildManifest = resolve(buildManifest, 'Cargo.toml')
}
if (basename(buildManifest) === 'Cargo.toml') {
  buildFromCargoToml(buildManifest, buildArgs)
} else {
  buildFromBuildScript(buildManifest, buildArgs)
}

function buildFromCargoToml (cargoToml, buildArgs) {
  console.info(bold('Build manifest:'), relative(cwd(), cargoToml))
  const workspace = dirname(cargoToml)
  const manifest  = TOML.parse(readFileSync(cargoToml, 'utf8'))
  const source    = new Source(workspace, manifest.package.name)
  Scrt_1_2.getBuilder().build(source)
    .then(artifact=>{
      console.info('Built', artifact)
      process.exit(0)
    })
    .catch(e=>{
      console.error(`Build failed.`)
      console.error(e)
      process.exit(5)
    })
}

function buildFromBuildScript (buildScript, buildArgs) {
  const buildSetName = buildArgs.join(' ')
  console.info(bold('Build script:'), relative(cwd(), buildScript))
  console.info(bold('Build set:   '), buildSetName || bold('(none)'))
  import(resolve(buildScript)).then(({default: buildSets})=>{
    if (buildArgs.length > 0) {
      const buildSet = buildSets[buildSetName]
      if (!buildSet) {
        console.error(`No build set ${bold(buildSetName)}.`)
        list(buildSets)
        process.exit(1)
      } else if (!(buildSet instanceof Function)) {
        console.error(`Invalid build set ${bold(buildSetName)} - must be function, got: ${typeof buildSet}`)
        process.exit(2)
      } else {
        const buildSources = buildSet()
        if (!(buildSources instanceof Array)) {
          console.error(`Invalid build set ${bold(buildSetName)} - must return Array<Source>, got: ${typeof buildSources}`)
          process.exit(3)
        }
        const T0 = + new Date()
        Scrt_1_2.getBuilder().buildMany(buildSources)
          .then(()=>{
            const T1 = + new Date()
            console.info(`Build complete in ${T1-T0}ms.`)
            process.exit(0)
          })
          .catch(e=>{
            console.error(`Build failed.`)
            console.error(e)
            process.exit(4)
          })
      }
    } else {
      console.warn(bold('No build set specified.'))
      list(buildSets)
    }
  })
}

function list (buildSets) {
  console.log('Available build sets:')
  for (let [name, sources] of Object.entries(buildSets)) {
    console.log(`\n  ${name}`)
    sources = (sources as Function)() as any
    for (const source of sources as Array<Source>) {
      console.log(`    ${bold(source.crate)} @ ${source.ref}`)
    }
  }
}
