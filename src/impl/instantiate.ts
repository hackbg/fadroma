import type { Agent } from '../API'

export async function instantiate (agent: Agent, ...args: Parameters<Agent["instantiate"]>) {

  let [contract, options] = args

  if (typeof contract === 'string') {
    contract = new UploadedCode({ codeId: contract })
  }

  if (isNaN(Number(contract.codeId))) {
    throw new Error(`can't instantiate contract with missing code id: ${contract.codeId}`)
  }

  if (!contract.codeId) {
    throw new Error("can't instantiate contract without code id")
  }

  if (!options.label) {
    throw new Error("can't instantiate contract without label")
  }

  if (!(options.initMsg||('initMsg' in options))) {
    throw new Error("can't instantiate contract without init message")
  }

  const { codeId, codeHash } = contract

  const result = await timed(function doInstantiate () {
    return into(options.initMsg).then(initMsg=>agent.getConnection().instantiateImpl({
      ...options,
      codeId,
      codeHash,
      initMsg
    }))
  }, function afterInstantiate ({ elapsed, result }) {
    agent.log.debug(
      `Instantiated in ${bold(elapsed)}:`,
      `code id ${bold(String(codeId))} as `,
      `${bold(options.label)} (${result.address})`
    )
  })

  return new Contract({
    ...options, ...result
  }) as Contract & {
    address: Address
  }

}
