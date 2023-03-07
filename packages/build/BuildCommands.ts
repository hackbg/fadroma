import BuilderConfig from './BuilderConfig'

import { CommandContext } from '@hackbg/cmds'

export default class BuildCommands extends CommandContext {
  constructor (public config: BuilderConfig = new BuilderConfig()) {
    super()
  }
}
