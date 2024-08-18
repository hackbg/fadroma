
export async function instantiate (
  conn: ScrtSigningConnection,
  args: Parameters<SigningConnection["instantiateImpl"]>[0]
) {
  const { chain, api, address, log, fees } = conn
  const parameters = {
    sender:     conn.address,
    code_id:    Number(args.codeId),
    code_hash:  args.codeHash,
    label:      args.label!,
    init_msg:   args.initMsg,
    init_funds: args.initSend,
    memo:       args.initMemo
  }
  const instantiateOptions = {
    gasLimit: Number(fees.init?.amount[0].amount) || undefined
  }
  const result = await withIntoError(
    api.tx.compute.instantiateContract(parameters, instantiateOptions)
  )

  if (result.code !== 0) {
    log.error('Init failed:', {
      parameters,
      instantiateOptions,
      result
    })
    throw new Error(`init of code id ${args.codeId} failed`)
  }

  return new Contract({
    chain,
    address:  result.arrayLog!.find(
      ({ type, key }: { type: string, key: string }) =>
        type === "message" && key === "contract_address"
    )?.value!,
    codeHash: args.codeHash,
    initBy:   address,
    initTx:   result.transactionHash,
    initGas:  result.gasUsed,
    label:    args.label,
  }) as Contract & { address: Address }
}

