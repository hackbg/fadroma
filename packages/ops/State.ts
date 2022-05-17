import type { Chain } from '@fadroma/client'
import { Path } from '@hackbg/kabinet'
import { Deployments } from './Deploy'
import { Uploads } from './Upload'
import { config } from './Config'

export const DIR_RECEIPTS = 'receipts'
export const DIR_DEPLOYS  = 'deployments'
export const DIR_UPLOADS  = 'uploads'
export const DIR_TXS      = 'transactions'

export function getDeployments ({ id }: Chain, root = config.projectRoot): Deployments {
  return new Path(root).in(DIR_RECEIPTS).in(id).in(DIR_DEPLOYS).asDir(Deployments)
}

export function getUploads ({ id }: Chain, root = config.projectRoot): Uploads {
  return new Path(root).in(DIR_RECEIPTS).in(id).in(DIR_UPLOADS).asDir(Uploads)
}
