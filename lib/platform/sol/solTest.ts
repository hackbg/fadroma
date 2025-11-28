export const testAx = (name, address, ...validators) =>
  expect(name, Fn(exists, address, name), ...validators)
export const testTx = (name, signers, ...args) =>
  expect(name, Fn(sendIxs, signers, ...args))
export const forbidTx = (signers, name, ...args) =>
  forbid(name, Fn(sendIxs, signers, ...args))
export const logMustContain = (text) =>
  reflect(`must log ${text}`, function logMustContainRun (tx) {
    return tx
    //const { transactionLogs: logs = [] } = e
    //try {
      //ok(logs.filter(includes(text)).length > 0, `error logs MUST contain ${text}`)
    //} catch (e) {
      //console.error({logs})
      //throw e
    //}
  })
export const errorLogMustContain = (text) => reflect(`must error with ${text}`,
  function errorLogMustContainRun (e) {
    const { transactionLogs: logs = [] } = e
    if (logs.filter(includes(text)).length > 0, `error logs MUST contain ${text}`) {
      return e
    }
    throw e
  })
export async function assertBalance (address, value, name) {
  const balance = await connection.getBalance(address);
  equal(balance, value, `${name} MUST have ${value} lamports`);
  return balance;
}
export async function exists (address, name) {
  try {
    const data = await get(address);
    ok(!!data, `${name} at ${address} MUST exist`);
    return data
  } catch (e) {
    throw formatError(e, name)
  }
}
