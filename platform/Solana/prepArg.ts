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
