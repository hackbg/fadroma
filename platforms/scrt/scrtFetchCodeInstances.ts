

export async function fetchCodeInstances (
  { chainId, api, log }: ScrtConnection,
  args: Parameters<Connection["fetchCodeInstancesImpl"]>[0]
):
  Promise<Record<CodeId, Record<Address, Contract>>>
{
  if (args.parallel) {
    log.warn('fetchCodeInstances in parallel: not implemented')
  }
  const result: Record<CodeId, Record<Address, Contract>> = {}
  for (const [codeId, Contract] of Object.entries(args.codeIds)) {
    let codeHash: string
    const instances = {}
    await withIntoError(api.query.compute.codeHashByCodeId({ code_id: codeId }))
      .then(({code_hash})=>codeHash = code_hash!)
    await withIntoError(api.query.compute.contractsByCodeId({ code_id: codeId }))
      .then(({contract_infos})=>{
        for (const { contract_address, contract_info: { label, creator } } of contract_infos!) {
          result[codeId] ??= {}
          result[codeId][contract_address!] = new Contract({
            chain,
            codeId,
            codeHash,
            label,
            address: contract_address,
            initBy:  creator
          })
        }
      })
    result[codeId] = instances
  }
  return result
}
