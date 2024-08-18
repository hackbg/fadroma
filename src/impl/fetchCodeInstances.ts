import type { Chain, CodeId, Address, Contract } from '../API'
import { timed } from '../Util'

export async function fetchCodeInstances (
  chain: Chain, ...args: Parameters<Chain["fetchCodeInstances"]>
) {
    let $C = Contract
    let custom = false
    if (typeof args[0] === 'function') {
      $C = args.shift() as typeof Contract
      let custom = true
    }
    if (!args[0]) {
      throw new Error('Invalid arguments')
    }

    if ((args[0] as any)[Symbol.iterator]) {
      const result: Record<CodeId, Record<Address, Contract>> = {}
      const codeIds: Record<CodeId, typeof $C> = {}
      for (const codeId of args[0] as unknown as CodeId[]) {
        codeIds[codeId] = $C
      }
      chain.log.debug(`Querying contracts with code ids ${Object.keys(codeIds).join(', ')}...`)
      return timed(function doFetchCodeInstances () {
        return chain.getConnection().fetchCodeInstancesImpl({ codeIds })
      }, function afterFetchCodeInstances ({elapsed}) {
        chain.log.debug(`Queried in ${elapsed}ms`)
      })
    }

    if (typeof args[0] === 'object') {
      if (custom) {
        throw new Error('Invalid arguments')
      }
      const result: Record<CodeId, Record<Address, Contract>> = {}
      chain.log.debug(`Querying contracts with code ids ${Object.keys(args[0]).join(', ')}...`)
      const codeIds = args[0] as { [id: CodeId]: typeof Contract }
      return timed(function doFetchCodeInstances () {
        return chain.getConnection().fetchCodeInstancesImpl({ codeIds })
      }, function afterFetchCodeInstances ({elapsed}) {
        chain.log.debug(`Queried in ${elapsed}ms`)
      })
    }

    if ((typeof args[0] === 'number')||(typeof args[0] === 'string')) {
      const id = args[0]
      chain.log.debug(`Querying contracts with code id ${id}...`)
      const result = {}
      return timed(function doFetchCodeInstances () {
        return chain.getConnection().fetchCodeInstancesImpl({ codeIds: { [id]: $C } })
      }, function afterFetchCodeInstances ({elapsed}) {
        chain.log.debug(`Queried in ${elapsed}ms`)
      })
    }

    throw new Error('Invalid arguments')
}
