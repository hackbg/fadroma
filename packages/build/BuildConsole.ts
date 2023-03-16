import { HEAD } from '@fadroma/core'
import type { Template, Built } from '@fadroma/core'

import { CommandsConsole } from '@hackbg/cmds'
import $ from '@hackbg/file'
import type { Path } from '@hackbg/file'
import { colors, bold } from '@hackbg/logs'

export default class BuildConsole extends CommandsConsole {

  label = '@fadroma/build'

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

  buildingOne ({ crate = '(unknown)', revision = 'HEAD' }: Partial<Template<any>>) {
    this.log('Building ', bold(crate), ...
      (revision === 'HEAD') ? ['from working tree'] : ['from Git reference', bold(revision)])
  }

  buildingMany (sources: Template<any>[]) {
    for (const source of sources) this.buildingOne(source)
  }

  prebuilt (prebuilt: Built) {
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
