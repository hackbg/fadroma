/// # Fadroma CLI: Build command

import $, { Path, OpaqueDirectory, OpaqueFile, TOMLFile } from '@hackbg/kabinet'
import { Console, bold }                                  from '@hackbg/konzola'
import { BuildConfig, getBuilder, Workspace, Source }     from '@fadroma/build'
import { SecretNetworkConfig }                            from '@fadroma/scrt'

export const config = {
  /** Build settings. */
  build: new BuildConfig(process.env),
  /** Secret Network settings. */
  scrt:  new SecretNetworkConfig(process.env)
}

type CargoTOML = TOMLFile<{ package: { name: string } }>

const console = Console('Fadroma Build')

const [buildPath, ...buildArgs] = process.argv.slice(2)

const buildSpec = $(buildPath)

if (buildSpec.isDirectory()) {
  console.log(buildSpec)
  buildFromDirectory(buildSpec.as(OpaqueDirectory))
} else if (buildSpec.isFile()) {
  buildFromFile(buildSpec.as(OpaqueFile))
} else {
  printUsage()
}

function printUsage () {
  console.log(`
    Usage:
      fadroma build path/to/crate
      fadroma build path/to/Cargo.toml
      fadroma build buildConfig.{js|ts}`)
  process.exit(6)
}

function buildFromDirectory (dir: OpaqueDirectory) {
  const cargoToml = dir.at('Cargo.toml').as(TOMLFile)
  if (cargoToml.exists()) {
    buildFromCargoToml(cargoToml as CargoTOML)
  } else {
    printUsage()
  }
}

function buildFromFile (file: TOMLFile<unknown>|OpaqueFile) {
  if (file.name === 'Cargo.toml') {
    buildFromCargoToml(file as CargoTOML)
  } else {
    buildFromBuildScript(file as OpaqueFile)
  }
}

async function buildFromCargoToml (
  cargoToml: CargoTOML,
  workspace: Workspace = new Workspace(
    process.env.FADROMA_BUILD_WORKSPACE_ROOT||cargoToml.parent
  )
) {
  console.info('Build manifest:', bold(cargoToml.shortPath))
  const source = workspace.crate((cargoToml.as(TOMLFile).load() as any).package.name)
  try {
    const builder = getBuilder({
      ...(config?.build??{}),
      ...(config?.scrt?.build??{}),
      rebuild: true
    })
    const artifact = await builder.build(source)
    console.info('Built:    ', bold($(artifact.url).shortPath))
    console.info('Code hash:', bold(artifact.codeHash))
    process.exit(0)
  } catch (e) {
    console.error(`Build failed.`)
    console.error(e)
    process.exit(5)
  }
}

async function buildFromBuildScript (buildScript: OpaqueFile) {
  const buildSetName = buildArgs.join(' ')
  console.info('Build script:', bold(buildScript.shortPath))
  console.info('Build set:   ', bold(buildSetName || '(none)'))
  //@ts-ignore
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
        const builder = getBuilder({
          ...(config?.build??{}),
          ...(config?.scrt?.build??{}),
          rebuild: true
        })
        await builder.buildMany(buildSources)
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
