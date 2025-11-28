function preparePk (pk) {
  let pkView = (pk?.toString()||'')
  if (pkView === '11111111111111111111111111111111') pkView = purple(pkView.padEnd(51))
  if (pkView === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') pkView = purple(pkView.padEnd(51))
  if (pkView === payer.publicKey.toString()) pkView = yellow(pkView.padEnd(51))
  pkView = pkView.padEnd(51)
  return pkView
}
