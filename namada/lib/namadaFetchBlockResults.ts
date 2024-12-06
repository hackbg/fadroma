import type * as Namada from './namadaTypes.ts'

export async function fetchBlockResults (
  connection: Namada.ConnectionBase,
  args?: { height: bigint|number } | { hash: string }
) {
  if (!args || ('height' in args)) {
    return fetchBlockResultsByHeight(connection, args?.height)
  } else if ('hash' in args) {
    throw new Error('fetchBlockResultsByHash: todo')
  } else {
    throw new Error('2nd arg must be { height } or falsy')
  }
}

export async function fetchBlockResultsByHeight (
  { url }: Namada.ConnectionBase,
  height?: bigint|number,
): Promise<Namada.BlockResults> {
  const response = await fetch(`${url}/block_results?height=${height??''}`)
  const { error, result } = await response.json() as {
    error: {
      data: string
    },
    result: {
      height:                  string
      txs_results:             unknown[]|null
      begin_block_events:      unknown[]|null
      end_block_events:        unknown[]|null
      validator_updated:       unknown[]|null
      consensus_param_updates: unknown[]|null
    },
  }
  if (error) {
    throw new Error(error.data)
  }
  const returned: Partial<Namada.BlockResults> = {}
  for (const [key, value] of Object.entries(result)) {
    Object.assign(returned, { [Case.camel(key) as keyof Namada.BlockResults]: value as any })
  }
  return returned as Namada.BlockResults
}
