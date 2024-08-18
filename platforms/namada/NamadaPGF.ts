import { assign } from '@hackbg/fadroma'
import type NamadaConnection from './NamadaConnection'

export type Params = Awaited<ReturnType<typeof fetchPGFParameters>>

export async function fetchPGFParameters (connection: Pick<NamadaConnection, 'abciQuery'|'decode'>) {
  const binary = await connection.abciQuery(`/vp/pgf/parameters`)
  return connection.decode.pgf_parameters(binary)
}

export async function fetchPGFStewards (connection: Pick<NamadaConnection, 'abciQuery'|'decode'>) {
  throw new Error("not implemented")
}

export async function fetchPGFFundings (connection: Pick<NamadaConnection, 'abciQuery'|'decode'>) {
  throw new Error("not implemented")
}

export async function isPGFSteward (connection: Pick<NamadaConnection, 'abciQuery'|'decode'>) {
  throw new Error("not implemented")
}
