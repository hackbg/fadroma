import Case from 'case'
import { argv, exit } from 'node:process'
import { fileURLToPath } from 'node:url'
import { Transaction, provider, connection, payer, BN, PK } from './connect.ts'
import { stringify, showTx, red, blue, yellow, purple, pad2, toHex } from './format.ts'
export * from './connect.ts'
export * from './format.ts'
export const entrypoint = async (url, callback) => {
  const [_, main, ...args] = argv
  if ((url === true) || (main === fileURLToPath(url))) {
    setImmediate(()=>callback(...args).catch(e=>{
      console.error(e);
      process.exit(1);
    }))
  }
  return callback
}
export const lazy = async ix => {
  ix = await ix
  if (typeof ix === 'function') ix = ix()
  return await ix
}
export const sendTx = async (signers, tx) =>
  provider.sendAndConfirm(await showTx(await tx), signers);
export const sendIx = async (signers, ix) =>
  sendTx(signers, new Transaction().add(await lazy(ix)))
export const sendIxs = async (signers, ...ixs) =>
  sendTx(signers, buildTx(...ixs));
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
export const buildIx = async (
  program, [methodName, ...args], accounts, ...remainingAccounts
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
const buildTxVerbosity = 2
const axByName = (a, b) => (a[0] > b[0]) ? 1 : (a[0] < b[0]) ? -1 : 0
const maxLength = 30//prepared.reduce((max, [name, _])=>Math.max(max, name.length), 28)
function findInIdl (program, name: string) {
  const rawName = Case.snake(name)
  return (program as any)._rawIdl.instructions.find(ix=>ix.name===rawName)
}
async function prepareAccount (ixIdl, account, pk) {
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
function preparePk (pk) {
  let pkView = (pk?.toString()||'')
  if (pkView === '11111111111111111111111111111111') pkView = purple(pkView.padEnd(51))
  if (pkView === 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb') pkView = purple(pkView.padEnd(51))
  if (pkView === payer.publicKey.toString()) pkView = yellow(pkView.padEnd(51))
  pkView = pkView.padEnd(51)
  return pkView
}
function prepareArg (ixName, arg, value, index) {
  try {
    let msg = ''
    if (!arg)
      throw new Error(`unexpected arg #${index} for ${ixName}`)
    let argType = arg.type ||
      (value instanceof BN ? 'u64' : typeof value)
    if (argType?.defined?.name)
      argType = argType.defined.name
    if (typeof argType === 'object')
      argType = stringify(argType)
    if (argType === 'bytes' && value?.length)
      argType += ` (${value.length})`
    if (buildTxVerbosity > 1)
      msg += `\n   · arg #${index}: ${argType}`.padEnd(55)
        + ` ` + Case.camel(arg.name) + '\n     ' + prepareArgVal(value)
    return [value, msg]
  } catch (e) {
    throw Object.assign(e, { ixName, value, index, ...arg })
  }
}
function prepareArgVal (arg) {
  const result =
    (arg === null)            ? red('null')      :
    (arg === undefined)       ? red('undefined') :
    (arg instanceof BN)       ? String(arg)      :
    (arg instanceof PK)       ? arg.toString()   :
    (arg instanceof Buffer)   ? showBuffer(arg) :
    (typeof arg === 'object') ? showObject(arg)  :
      JSON.stringify(arg)
  return result
}
function showBuffer (buffer) {
  return fields([...buffer]
    .map(x=>toHex(x))
    .reduce(grouped, [])
    .map(group=>group.join(' ')))
}
function showObject (object) {
  return fields(Object.entries(object)
    .map(([x,y])=>`· ${x.padEnd(20)} \n     ${
      (y instanceof Buffer) ? showBuffer(y) :
      JSON.stringify(y)}`))
}
function fields (fields) {
  return fields.join('\n     ')
}
function grouped (groups = [], item, index) {
  const group = Math.floor(index / 16)
  groups[group] ??= []
  groups[group].push(item)
  return groups
}
