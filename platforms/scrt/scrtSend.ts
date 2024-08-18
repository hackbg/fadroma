export async function send (agent: ScrtSigningConnection, {
  parallel = false,
  outputs,
  sendFee,
  sendMemo,
}: Parameters<SigningConnection["sendImpl"]>[0]) {
  const { api } = agent
  const sender = agent.address
  const transactions = []
  for (const [recipient, amounts] of Object.entries(outputs)) {
    transactions.push(()=>withIntoError(api.tx.bank.send(
      { from_address: sender, to_address: recipient, amount: amounts },
      { gasLimit: Number(sendFee?.gas) }
    )).then(transaction=>({
      sender, recipient, amounts, transaction
    })))
  }
  const result: Record<Address, {
    sender:      Address,
    recipient:   Address,
    amounts:     Record<string, string>
    transaction: unknown
  }> = {}
  const responses = await optionallyParallel(parallel, transactions)
  for (const response of responses) {
    result[response.recipient] = response
  }
  return result

  //return withIntoError(api.tx.bank.send(
    //{ from_address: this.address!, to_address: recipient, amount: amounts },
    //{ gasLimit: Number(options?.sendFee?.gas) }
  //))
}
