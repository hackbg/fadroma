export async function upload (agent: Agent, ...args: Parameters<Agent["upload"]>) {
  let [code, options] = args
  let template: Uint8Array
  if (code instanceof Uint8Array) {
    template = code
  } else {
    const { CompiledCode } = _$_HACK_$_
    if (typeof code === 'string' || code instanceof URL) {
      code = new CompiledCode({ codePath: code })
    } else {
      code = new CompiledCode(code)
    }
    const t0 = performance.now()
    code = code as CompiledCode
    template = await (code as any).fetch()
    const t1 = performance.now() - t0
    agent.log.log(
      `Fetched in`, `${bold((t1/1000).toFixed(6))}s: code hash`,
      bold(code.codeHash), `(${bold(String(code.codeData?.length))} bytes`
    )
  }
  agent.log.debug(`Uploading ${bold((code as any).codeHash)}`)
  const result = await timed(
    () => agent.getConnection().uploadImpl({
      ...options,
      binary: template
    }),
    ({elapsed, result}: any) => agent.log.debug(
      `Uploaded in ${bold(elapsed)}:`,
      `code with hash ${bold(result.codeHash)} as code id ${bold(String(result.codeId))}`,
    ))
  return new UploadedCode({
    ...template, ...result as any
  }) as UploadedCode & {
    chainId: ChainId
    codeId:  CodeId
  }
}
