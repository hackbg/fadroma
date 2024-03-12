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

import * as Chains from './cw-chains'
import { Core } from '@fadroma/agent'
import CLI from '@hackbg/cmds'
import { CWConsole } from './cw-base'
import { CWConnection } from './cw-connection'

export * as CosmJS from '@hackbg/cosmjs-esm'
export { CWError as Error, CWConsole as Console } from './cw-base'
export { CWConnection as Connection } from './cw-connection'
export { CWBatch as Batch } from './cw-batch'
export {
  CWIdentity         as Identity,
  CWSignerIdentity   as SignerIdentity,
  CWMnemonicIdentity as MnemonicIdentity,
  encodeSecp256k1Signature
} from './cw-identity'
export * from './cw-chains'

export default class CWCLI extends CLI {

  constructor (...args: ConstructorParameters<typeof CLI>) {
    super(...args)
    this.log.label = ``
  }

  archway   = this.commands('archway',   'commands for Archway',   new Chains.Archway.CLI())
  axelar    = this.commands('axelar',    'commands for Axelar',    new Chains.Axelar.CLI())
  injective = this.commands('injective', 'commands for Injective', new Chains.Injective.CLI())
  okp4      = this.commands('okp4',      'commands for OKP4',      new Chains.OKP4.CLI())
  osmosis   = this.commands('osmosis',   'commands for Osmosis',   new Chains.Osmosis.CLI())

  check = this.command({
    name: 'check',
    info: 'check if there is a working RPC endpoint at a given URL',
    args: 'RPC_URL [TIMEOUT_SEC]'
  }, async (url: string, timeout: number = 5) => {
    if (!url) {
      this.log.error(Core.bold('Pass a RPC URL to connect.'))
      process.exit(1)
    }
    const connection = new CWConnection({ url })
    this.log.info(`Will exit with error code if not connected in ${timeout}s.`)
    const timer = setTimeout(()=>{
      this.log.error(`Failed to connect in ${timeout}s.`)
      process.exit(1)
    }, timeout * 1000)
    let api
    try {
      api = await connection.api
    } catch (e) {
      this.log.error(e.stack)
      this.log.error(Core.bold(`Failed to connect because of the above error.`))
      process.exit(1)
    }
    clearTimeout(timer)
    this.log.log(api)
    this.log.log('Connected successfully.')
  })

}
