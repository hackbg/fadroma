import { CommandsConsole } from '@hackbg/komandi'
import $ from '@hackbg/kabinet'
import type { Path } from '@hackbg/kabinet'
import { colors, bold } from '@hackbg/konzola'
import { HEAD } from '@fadroma/core'
import type { ContractTemplate } from '@fadroma/core'

export class BuildConsole extends CommandsConsole {
  name = 'Fadroma.Builder'
  buildingFromCargoToml (file: Path|string) {
    this.log('Building from', bold($(file).shortPath))
  }
  buildingFromBuildScript (file: Path, args: string[] = []) {
    this.log('Build script:', bold(file.shortPath))
    this.log('Build args:  ', bold(args.join(' ') || '(none)'))
  }
  buildingFromWorkspace (mounted: Path|string, ref: string = HEAD) {
    this.log(
      `Building contracts from workspace:`, bold(`${$(mounted).shortPath}/`),
      `@`, bold(ref)
    )
  }
  buildingOne ({ crate = '(unknown)', revision = 'HEAD' }: Partial<ContractTemplate>) {
    this.log('Building ', bold(crate), ...
      (revision === 'HEAD') ? ['from working tree'] : ['from Git reference', bold(revision)])
  }
  buildingMany (sources: ContractTemplate[]) {
    for (const source of sources) this.buildingOne(source)
  }
  prebuilt (prebuilt: ContractTemplate) {
    this.log(`${colors.green('Found:')}   `, bold(colors.green($(prebuilt.artifact!).shortPath)))
  }
  usage () {
    this.info(`
      Usage:
        fadroma-build path/to/crate
        fadroma-build path/to/Cargo.toml
        fadroma-build buildConfig.{js|ts}`)
  }
  runningBuildContainer (root: string|Path, revision: string, cratesToBuild: string[]) {
    root = $(root).shortPath
    const crates = cratesToBuild.map(x=>bold(x)).join(', ')
    this.log(`Started building from ${bold(root)} @ ${bold(revision)}:`, crates)
  }
}
