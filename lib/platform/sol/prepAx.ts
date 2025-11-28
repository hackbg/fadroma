export async function prepareAccount (ixIdl, account, pk) {
  let msg = ''
  const name = Case.snake(account)
  if (!ixIdl.accounts.some(ax=>ax.name===name)) {
    const names = ixIdl.accounts.map(ax=>Case.camel(ax.name)).join(', ')
    throw new Error(`unexpected account: ${account}. allowed: ${names}`)
  }
  if (!(pk instanceof PK)) {
    pk = (typeof pk === 'object') ? stringify(pk) : pk
    throw new Error(`not a pubkey: ${account} = ${pk}`)
  }
  if (buildTxVerbosity > 2) {
    let extra = '·'
    if (buildTxVerbosity > 3) {
      const [balance, accountInfo] = await Promise.all([
        connection.getBalance(pk), connection.getAccountInfo(pk)
      ])
      extra += ' ' + yellow((balance ? String(balance) : '---').padStart(18))
      extra += '  '
      if (accountInfo) {
        const { space = '' } = accountInfo as any
        extra += blue((String(space)+'b').padStart(8))
      } else {
        extra += '        '
      }
      if (accountInfo) {
        extra += `  `
        accountInfo.data.slice(0, 8).forEach((byte, _index)=>{
          extra += `${toHex(byte, 2)} `
        })
      }
    }
    const pkView = preparePk(pk)
    msg += '\n   ' + [pkView, account.padEnd(maxLength), extra].join(' ')
  }
  return [account, pk, msg]
}

