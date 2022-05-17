import {
  Source, getScrtBuilder,
  Console, bold,
} from '../index'

import { Path, TOML } from '@hackbg/kabinet'

const console = Console('Fadroma Build')
let [buildManifest,...buildArgs] = process.argv.slice(2)

if (buildManifest) {
  buildManifest = new Path(buildManifest).assert()
  if (buildManifest.isDir) {
    buildManifest = buildManifest.asDir().at('Cargo.toml').as(TOML)
  }
  if (buildManifest.name === 'Cargo.toml') {
    buildFromCargoToml(buildManifest, buildArgs)
  } else {
    buildFromBuildScript(buildManifest, buildArgs)
  }
} else {
  console.error('Pass a path to either:')
  console.error(' - a contract crate directory')
  console.error(' - a Cargo.toml')
  console.error(' - an ES module exporting build sets')
  process.exit(6)
}

async function buildFromCargoToml (cargoToml, buildArgs) {
  console.info(bold('Build manifest:'), cargoToml.shortPath)
  const workspace = cargoToml.parent
  const manifest  = cargoToml.load()
  const source    = new Source(workspace, manifest.package.name)
  try {
    const artifact = await getScrtBuilder().build(source)
    console.info('Built', artifact)
    process.exit(0)
  } catch (e) {
    console.error(`Build failed.`)
    console.error(e)
    process.exit(5)
  }
}

async function buildFromBuildScript (buildScript, buildArgs) {
  const buildSetName = buildArgs.join(' ')
  console.info(bold('Build script:'), buildScript.shortPath)
  console.info(bold('Build set:   '), buildSetName || bold('(none)'))
  const {default: buildSets} = await import(buildScript.path)
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
      try {
        await getScrtBuilder().buildMany(buildSources)
        const T1 = + new Date()
        console.info(`Build complete in ${T1-T0}ms.`)
        process.exit(0)
      } catch (e) {
        console.error(`Build failed.`)
        console.error(e)
        process.exit(4)
      }
    }
  } else {
    console.warn(bold('No build set specified.'))
    list(buildSets)
  }
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
