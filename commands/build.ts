import $, { OpaqueDirectory, OpaqueFile, TOMLFile } from '@hackbg/kabinet'
import { Workspace, getScrtBuilder, Source, Console, bold } from '../index'

const console = Console('Fadroma Build')
const [buildManifestPath,...buildArgs] = process.argv.slice(2)

if (buildManifestPath) {
  let buildManifest = $(buildManifestPath).assert()
  if (buildManifest.isDir) {
    buildManifest = new OpaqueDirectory(buildManifest).at('Cargo.toml').as(TOMLFile)
  }
  if (buildManifest.name === 'Cargo.toml') {
    buildFromCargoToml(buildManifest.as(TOMLFile) as TOMLFile<CargoTOML>)
  } else {
    buildFromBuildScript(buildManifest.as(OpaqueFile), buildArgs)
  }
} else {
  console.error('Pass a path to either:')
  console.error(' - a contract crate directory')
  console.error(' - a Cargo.toml')
  console.error(' - an ES module exporting build sets')
  process.exit(6)
}

interface CargoTOML { package: { name: string } }

async function buildFromCargoToml (cargoToml: TOMLFile<CargoTOML>) {
  console.info('Build manifest:', bold(cargoToml.shortPath))
  const workspace = new Workspace(cargoToml.parent)
  const source    = workspace.crate(cargoToml.load().package.name)
  try {
    const artifact = await getScrtBuilder().build(source)
    console.info('Built:    ', bold($(artifact.url).shortPath))
    console.info('Code hash:', bold(artifact.codeHash))
    process.exit(0)
  } catch (e) {
    console.error(`Build failed.`)
    console.error(e)
    process.exit(5)
  }
}

async function buildFromBuildScript (buildScript: OpaqueFile, buildArgs) {
  const buildSetName = buildArgs.join(' ')
  console.info('Build script:', bold(buildScript.shortPath))
  console.info('Build set:   ', bold(buildSetName || '(none)'))
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
      console.log(`    ${bold(source.crate)} @ ${source.workspace.ref}`)
    }
  }
}
