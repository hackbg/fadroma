import $, { Path, OpaqueDirectory, OpaqueFile, TOMLFile }  from '@hackbg/kabinet'
import { Console, bold }                                   from '@hackbg/konzola'
import { getBuilderConfig, getBuilder, Workspace, Source } from '@fadroma/build'

export const config = {
  /** Build settings. */
  build: getBuilderConfig(process.cwd(), process.env),
}
