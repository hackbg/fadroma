import type { Identity } from './coreTypes.ts'
import { Logs } from '../deps.ts'

export function assignColor (identity: Identity): Identity & { color: unknown } {
  identity.color = Logs.randomColor({ luminosity: 'dark', seed: identity.id })
  return identity as Identity & { color: unknown }
}
