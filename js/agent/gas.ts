export const gas = function formatGas (x) {
  return {amount:[{amount:String(x),denom:'uscrt'}], gas: String(x)}
}

export const defaultFees = {
  upload: gas(3000000),
  init:   gas(1000000),
  exec:   gas(1000000),
  send:   gas( 500000),
}
