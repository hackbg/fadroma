import { CommandsConsole } from '@hackbg/komandi'
import $ from '@hackbg/kabinet'
import type { Path } from '@hackbg/kabinet'
import { colors, bold } from '@hackbg/konzola'
import { HEAD } from '@fadroma/client'
import type { Contract } from '@fadroma/client'

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
  buildingOne (source: Contract<any>, prebuilt: Contract<any>|null = null) {
    if (prebuilt) {
      this.log(`${colors.green('Found:')}   `, bold(colors.green($(prebuilt.artifact!).shortPath)))
    } else {
      const { crate = '(unknown)', revision = 'HEAD' } = source
      this.log('Building ', bold(crate), ...
        (revision === 'HEAD') ? ['from working tree'] : ['from Git reference', bold(revision)])
    }
  }
  buildingMany (sources: Contract<any>[]) {
    for (const source of sources) {
      this.buildingOne(source, null)
    }
  }
}
