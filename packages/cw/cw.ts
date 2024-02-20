/**
  Fadroma CW
  Copyright (C) 2023 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/

export * as CosmJS from '@hackbg/cosmjs-esm'

export {
  CWError            as Error,
  CWConsole          as Console,
} from './cw-base'

export {
  CWConnection       as Connection,
  CWBatch            as Batch,
} from './cw-connection'

export {
  CWIdentity         as Identity,
  CWSignerIdentity   as SignerIdentity,
  CWMnemonicIdentity as MnemonicIdentity,
  encodeSecp256k1Signature
} from './cw-identity'

export * as Archway   from './archway/archway'
export * as Axelar    from './axelar/axelar'
export * as Injective from './injective/injective'
export * as OKP4      from './okp4/okp4'
export * as Osmosis   from './osmosis/osmosis'
export * as Namada    from './namada/namada'

import { Core } from '@fadroma/agent'
import CLI from '@hackbg/cmds'
import { CWConsole } from './cw-base'
import { CWConnection } from './cw-connection'
const console = new CWConsole()
export default class CWCLI extends CLI {

  constructor (...args: ConstructorParameters<typeof CLI>) {
    super(...args)
    this.log.label = ``
  }

  bech32 = this.command({
    name: 'bech32',
    info: 'create a random bech32 address',
    args: 'PREFIX [LENGTH]'
  }, (prefix: string, length: string|number = "20") => {
    if (!prefix) {
      console.error('Pass a prefix to generate address')
      process.exit(1)
    }
    if (isNaN(Number(length))) {
      console.error(`Not a number: ${length}. Pass a valid length.`)
      process.exit(1)
    }
    console.log(Core.randomBech32(prefix, Number(length)))
  })

  bech32m = this.command({
    name: 'bech32m',
    info: 'create a random bech32m address',
    args: 'PREFIX [LENGTH]'
  }, (prefix: string, length: string|number = "20") => {
    if (!prefix) {
      console.error('Pass a prefix to generate address')
      process.exit(1)
    }
    if (isNaN(Number(length))) {
      console.error(`Not a number: ${length}. Pass a valid length.`)
      process.exit(1)
    }
    console.log(Core.randomBech32m(prefix, Number(length)))
  })

  check = this.command({
    name: 'check',
    info: 'try connecting to a RPC endpoint',
    args: 'RPC_URL [TIMEOUT_SEC]'
  }, async (url: string, timeout: number = 5) => {
    if (!url) {
      console.error('Required argument: RPC_URL')
      process.exit(1)
    }
    const connection = new CWConnection({ url })
    console.info(`Will exit with error code if not connected in ${timeout}s.`)
    const timer = setTimeout(()=>{
      console.error(`Failed to connect in ${timeout}s.`)
      process.exit(1)
    }, timeout * 1000)
    let api
    try {
      api = await connection.api
    } catch (e) {
      console.error(e.stack)
      console.error(`Failed to connect because of the above error.`)
      process.exit(1)
    }
    clearTimeout(timer)
    console.log(api)
    console.log('Connected successfully.')
  })

  validators = this.command({
    name: 'validators',
    info: 'list validators for a RPC endpoint',
    args: 'BECH32_PREFIX RPC_URL'
  }, async (prefix: string, url: string) => {
    if (!url) {
      console.error('Required argument: RPC_URL')
      process.exit(1)
    }
    if (!prefix) {
      console.error('Required argument: BECH32_PREFIX')
      process.exit(1)
    }
    const connection = new CWConnection({ url })
    const validators = await connection.getValidators({ prefix })
    for (const validator of validators) {
      this.log.br()
        .info('Validator:        ', Core.bold(validator.address))
        .info('Address (hex):    ', Core.bold(validator.addressHex))
        .info('Public key:       ', Core.bold(validator.pubKeyHex))
        .info('Voting power:     ', Core.bold(String(validator.votingPower)))
        .info('Proposer priority:', Core.bold(String(validator.proposerPriority)))
    }
    this.log.br().info('Total validators:', Core.bold(String(validators.length)))
  })
}
