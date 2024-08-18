

export async function upload (
  agent: ScrtSigningConnection,
  args: Parameters<SigningConnection["uploadImpl"]>[0]
) {
  const { api, address, fees, log } = agent

  const result = await withIntoError(api.tx.compute.storeCode({
    sender:         address,
    wasm_byte_code: args.binary,
    source:         "",
    builder:        ""
  }, {
    gasLimit:       Number(fees.upload?.amount[0].amount) || undefined
  }))

  const {
    code,
    message,
    details = [],
    rawLog
  } = result as typeof result & { message?: any, details?: any[] }

  if (code !== 0) {
    log.error(
      `Upload failed with code ${bold(code)}:`,
      bold(message ?? rawLog ?? ''),
      ...details
    )
    if (message === `account ${address} not found`) {
      log.info(`If this is a new account, send it some SCRT first.`)
      const chainId = agent.chain.chainId
      if (faucets[chainId]) {
        log.info(`Available faucets\n `, [...faucets[chainId]].join('\n  '))
      }
    }
    log.error(`Upload failed`, { result })
    throw new Error('upload failed')
  }

  type Log = { type: string, key: string }

  const codeId = result.arrayLog
    ?.find((log: Log) => log.type === "message" && log.key === "code_id")
    ?.value
  if (!codeId) {
    log.error(`Code ID not found in result`, { result })
    throw new Error('upload failed')
  }
  const { codeHash } = await agent.chain.fetchCodeInfo(codeId)
  return new UploadedCode({
    chainId:   agent.chain.chainId,
    codeId,
    codeHash,
    uploadBy:  address,
    uploadTx:  result.transactionHash,
    uploadGas: result.gasUsed
  })
}
