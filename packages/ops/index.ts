export * from '@hackbg/tools'

export * from './Build'

export * from './Schema'

export * from './ChainNode'

export * from './Chain'

export * from './Agent'

export * from './Upload'

export * from './Contract'

export * from './Deployment'

export * from './Client'

// bez dom:

import { colors, bold, Console } from '@hackbg/tools'

const console = Console('@hackbg/fadroma')

export function printContract (contract) {
  console.info(
    bold(String(contract.codeId).padStart(7)),
    contract.address,
    bold(contract.label)
  )
  console.info(
    bold("".padEnd(7)),
    bold(contract.codeHash),
  )
}

export async function printToken (TOKEN) {
  if (typeof TOKEN === 'string') {
    console.info(
      `   `,
      bold(TOKEN.padEnd(10))
    )
  } else {
    const {name, symbol} = await TOKEN.q().tokenInfo()
    console.info(
      `   `,
      bold(symbol.padEnd(10)),
      name.padEnd(25).slice(0, 25),
      TOKEN.address
    )
  }
}

export async function printExchanges (OLD_EXCHANGES: any[]) {
  for (const {
    name, EXCHANGE: { codeId, codeHash, address },
    TOKEN_0, TOKEN_1, LP_TOKEN
  } of OLD_EXCHANGES) {
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
