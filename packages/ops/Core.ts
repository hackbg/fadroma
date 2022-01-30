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
    bold('Code hash:'), contract.codeHash,
  )
  console.info(
    bold("".padEnd(12)),
    bold('Address:'), contract.address,
  )
  console.info(
    bold("".padEnd(12)),
    bold('Label:'), contract.label,
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

export async function printExchanges (EXCHANGES: any[]) {
  for (const EXCHANGE of EXCHANGES) {
    const {
      name, EXCHANGE: { codeId, codeHash, address },
      TOKEN_0, TOKEN_1, LP_TOKEN
    } = EXCHANGE
    console.info(
      ' ',
      bold(colors.inverse(name)).padEnd(30), // wat
      `(code id ${bold(String(codeId))})`.padEnd(34),
      bold(address)
    )
    await printToken(TOKEN_0)
    await printToken(TOKEN_1)
    await printToken(LP_TOKEN)
  }
}
