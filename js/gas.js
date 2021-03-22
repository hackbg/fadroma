function gas (x) {
  return {amount:[{amount:String(x),denom:'uscrt'}], gas:String(x)}
}

const defaultFees =
  { upload: gas(2000000)
  , init:   gas( 500000)
  , exec:   gas( 400000)
  , send:   gas( 400000) }

export default Object.assign(gas, { defaultFees })
