import { CommandsConsole } from '@hackbg/komandi'
import $ from '@hackbg/kabinet'
import type { Path } from '@hackbg/kabinet'
import { bold } from '@hackbg/konzola'
import { HEAD } from '@fadroma/client'
import type { Contract } from '@fadroma/client'

export class BuildConsole extends CommandsConsole {
  name = 'Fadroma Build'
  buildingFromCargoToml (file: Path|string) {
    this.info('Building from', bold($(file).shortPath))
  }
  buildingFromBuildScript (file: Path, args: string[] = []) {
    this.info('Build script:', bold(file.shortPath))
    this.info('Build args:  ', bold(args.join(' ') || '(none)'))
  }
  buildingFromWorkspace (mounted: Path|string, ref: string = HEAD) {
    this.info(
      `Building contracts from workspace:`, bold(`${$(mounted).shortPath}/`),
      `@`, bold(ref)
    )
  }
  buildingOne (source: Contract<any>, prebuilt: Contract<any>|null = null) {
    if (prebuilt) {
      this.info('Reuse    ', bold($(prebuilt.artifact!).shortPath))
    } else {
      const { crate = '(unknown)', revision = 'HEAD' } = source
      this.info('Building', bold(crate), ...
        (revision === 'HEAD') ? ['from working tree'] : ['from Git reference', bold(revision)])
    }
  }
  buildingMany (sources: Contract<any>[]) {
    for (const source of sources) {
      this.buildingOne(source, null)
    }
    this.info()
  }
}

