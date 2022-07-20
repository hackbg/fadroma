/// # Fadroma CLI: Build command

import $, { Path, OpaqueDirectory, OpaqueFile, TOMLFile }  from '@hackbg/kabinet'
import { Console, bold }                                   from '@hackbg/konzola'
import { getBuilderConfig, getBuilder, Workspace, Source } from '@fadroma/build'

export const config = {
  /** Build settings. */
  build: getBuilderConfig(process.cwd(), process.env),
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
      fadroma-build path/to/crate
      fadroma-build path/to/Cargo.toml
      fadroma-build buildConfig.{js|ts}`)
  process.exit(6)
}

