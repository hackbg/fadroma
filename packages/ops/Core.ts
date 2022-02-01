export type Identity = {
  chainId?:  string,
  address?:  string
  name?:     string,
  type?:     string,
  pubkey?:   string
  mnemonic?: string
  keyPair?:  any
  pen?:      any
  fees?:     any
}

export type ContractMessage = string|Record<string, any>

export type Gas = {
  amount: Array<{amount: string, denom: string}>
  gas:    string
}

export type Fees = {
  upload: Gas
  init:   Gas
  exec:   Gas
  send:   Gas
}

import { colors, bold, Console } from '@hackbg/tools'

const console = Console('@hackbg/fadroma')

export function printAligned (obj: Record<string, any>) {
  const maxKey = Math.max(...Object.keys(obj).map(x=>x.length), 15)
  for (let [key, val] of Object.entries(obj)) {
    if (typeof val === 'object') val = JSON.stringify(val)
    val = String(val)
    if ((val as string).length > 60) val = (val as string).slice(0, 60) + '...'
    console.info(bold(`  ${key}:`.padEnd(maxKey+3)), val)
  }
}

export function printContracts (contracts) {
  contracts.forEach(printContract)
}

export function printContract (contract) {
  console.info(
    String(contract.codeId).padStart(12),
    contract.address,
    contract.name
  )
}

export async function printToken (TOKEN) {
  if (typeof TOKEN === 'string') {
    console.info(
      `   `,
      bold(TOKEN.padEnd(10))
    )
  } else {
    const {name, symbol} = await TOKEN.info
    console.info(
      `   `,
      bold(symbol.padEnd(10)),
      name.padEnd(25).slice(0, 25),
      TOKEN.address
    )
  }
}
