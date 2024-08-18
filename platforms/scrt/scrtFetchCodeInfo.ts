export async function fetchCodeInfo (
  { chainId, api }: ScrtConnection,
  args: Parameters<Connection["fetchCodeInfoImpl"]>[0]
):
  Promise<Record<CodeId, UploadedCode>>
{
  const result: Record<CodeId, UploadedCode> = {}
  await withIntoError(api.query.compute.codes({})).then(({code_infos})=>{
    for (const { code_id, code_hash, creator } of code_infos||[]) {
      if (!args?.codeIds || args.codeIds.includes(code_id!)) {
        result[code_id!] = new UploadedCode({
          chainId,
          codeId:   code_id,
          codeHash: code_hash,
          uploadBy: creator
        })
      }
    }
  })
  return result
}

