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

import CLI from '@hackbg/cmds'
import { CWConsole } from './cw-base'
import { CWConnection } from './cw-connection'
const console = new CWConsole()
export default class CWCLI extends CLI {
  constructor (...args: ConstructorParameters<typeof CLI>) {
    super(...args)
    this.log.label = ``
  }
  connect = this.command({
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
}
