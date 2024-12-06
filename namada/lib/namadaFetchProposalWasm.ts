import type * as Namada from './namadaTypes.ts'

export async function fetchProposalWasm (
  connection: Namada.ConnectionBase, id: number|bigint
): Promise<Namada.GovernanceProposalWasm|null> {
  id = BigInt(id)
  const codeKey = connection.decode.gov_proposal_code_key(BigInt(id))
  let wasm
  const hasKey = await connection.abciQuery(`/shell/has_key/${codeKey}`)
  if (hasKey[0] === 1) {
    wasm = await connection.abciQuery(`/shell/value/${codeKey}`)
    wasm = wasm.slice(4) // trim length prefix
    return { id, codeKey, wasm }
  } else {
    return null
  }
}
