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
