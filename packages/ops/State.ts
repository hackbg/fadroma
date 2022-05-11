import { Directory, resolve } from '@hackbg/toolbox'
import type { Chain } from '@fadroma/client'
import { Deployments } from './Deploy'
import { Uploads } from './Upload'
import { config } from './Config'

export const DIR_RECEIPTS = 'receipts'
export const DIR_DEPLOYS  = 'deployments'
export const DIR_UPLOADS  = 'uploads'
export const DIR_TXS      = 'transactions'

export function getDeployments (
  { id }: Chain,
  root = config.projectRoot
) {
  const statePath   = resolve(root, DIR_RECEIPTS, id)
  const deployments = new Directory(statePath).subdir(DIR_DEPLOYS, Deployments)
  return deployments
}

export function getUploads (
  { id }: Chain,
  root = config.projectRoot
) {
  const statePath   = resolve(root, DIR_RECEIPTS, id)
  const deployments = new Directory(statePath).subdir(DIR_UPLOADS, Uploads)
  return deployments
}
