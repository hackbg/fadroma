export * from './projectWizard'

export * from './Project'

import { Project } from './Project'
import $, { OpaqueDirectory, JSONFile } from '@hackbg/file'

/** @returns Project with config from "fadroma" key in package.json */
export function getProject (
  path: string|OpaqueDirectory = process.env.FADROMA_PROJECT || process.cwd()
): Project {
  const packageJSON = $(path).as(OpaqueDirectory).at('package.json').as(JSONFile).load()
  const { fadroma } = packageJSON as { fadroma: any }
  return new Project(fadroma)
}
