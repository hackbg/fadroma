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
