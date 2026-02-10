export const sendIx = async (signers: KP[], ix: unknown) =>
  sendTx(signers, new TX().add(await lazy(ix)))
export const sendIxs = (signers, ...ixs) =>
  sendTx(signers, buildTx(...ixs));
export const buildIx = async (
  program: Program, [methodName, ...args]: [string, ...unknown[]],
  accounts: Record<Name, MaybeAsync<PK>>, ...remainingAccounts: unknown[]
) => {
  let info = `⬅️` // Log in one burst at end to avoid interspersal with localnet logs
  const method = program.methods[methodName]
  if (!method) throw new Error(`not a method: ${methodName}`)
  const ixIdl = findInIdl(program, methodName);
  info += ['', blue(pad2(String(program.programId))), 'ix', blue(methodName)].join(' ')
  accounts = Object.entries(accounts).sort(axByName)
  accounts = accounts.map(([account, pk])=>prepareAccount(ixIdl, account, pk))
  accounts = Object.fromEntries(await Promise.all(accounts))
  accounts['systemProgram'] ??= PK.default
  const ix = await method(...ixIdl.args.map((argInfo, index)=>{
    const [arg, msg] = prepareArg(ixIdl.name, argInfo, args[index], index)
    info += msg
    return arg
  }))
    .accounts(accounts)
    .remainingAccounts(remainingAccounts)
    .instruction()
  console.debug(info)
  return ix
}
