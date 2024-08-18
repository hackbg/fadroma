

export async function query (
  conn: ScrtConnection,
  args: Parameters<Connection["queryImpl"]>[0]
) {
  const api = await Promise.resolve(conn.api)
  return withIntoError(api.query.compute.queryContract({
    contract_address: args.address,
    code_hash:        args.codeHash,
    query:            args.message as Record<string, unknown>
  }))
}
