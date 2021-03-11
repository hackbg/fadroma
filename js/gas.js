module.exports = Object.assign(
  gas,
  { defaultFees:
    { upload: gas(2000000)
    , init:   gas( 500000)
    , exec:   gas( 400000)
    , send:   gas(  80000) } })

function gas (x) {
  return {amount:[{amount:String(x),denom:'uscrt'}], gas:String(x)}
}
