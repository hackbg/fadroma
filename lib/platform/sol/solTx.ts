const buildTxVerbosity = 2
const sendTxVerbosity    = 1
const showAccountBalance = 0
const showAccountSize    = 0
const showAccountData    = 0
export const sendTx = async (signers: KP[], tx: unknown) =>
  provider.sendAndConfirm(await showTx(await tx), signers);
export const buildTx = async (...ixs) => {
  const info = []
  const tx = new Transaction();
  for (let ix of ixs) {
    if (ix) {
      ix = await lazy(ix)
      if (typeof ix === 'string') {
        info.push(ix)
      } else if (typeof ix !== 'boolean') {
        tx.add(ix)
      }
    }
  }
  Object.assign(tx, { description: info.join('; ') })
  return tx
}
export const showTx = async (tx) => {
  tx = await Promise.resolve(tx)
  let info = `⬅️ Send ${tx.instructions.length} ix`
  if (tx.description) info += `: ${tx.description}.`
  for (const ixIndex in tx.instructions) {
    const ix = tx.instructions[ixIndex];
    if (sendTxVerbosity > 1) info += `\n⬅️ IX#${String(ixIndex).padEnd(3)}to ${ix.programId.toString()} (${ix.data.length}b)`;
    const balances = await getBalances(ix.keys.map(ax=>ax.pubkey).filter(Boolean));
    for (const axIndex in ix.keys) {
      const ax  = ix.keys[axIndex];
      let key = ax.pubkey?.toString().padEnd(44)
      if (!key) key = red(`MISSING`.padEnd(44))
      const sig = ax.isSigner   ? 'sig' : '___';
      const mut = ax.isWritable ? 'mut' : '___';
      const bal = String(balances[axIndex]).padStart(18);
      if (sendTxVerbosity > 1) info += `\n   ax#${(String(axIndex)+':').padEnd(5)} ${key}  ${sig}  ${mut}  ${bal}`;
    }
    if (sendTxVerbosity > 1) if (ix.reflected) info += `\n🔍️ Reflected: ${stringify(ix.reflected)}`
  }
  if (sendTxVerbosity > 0) console.debug(info)
  return tx
}
