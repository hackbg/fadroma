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
  CWConsole          as Console
} from './CWBase'
export {
  CWChain            as Chain,
  CWConnection       as Connection,
} from './CWConnection'
export {
  CWBlock       as Block,
  CWTransaction as Transaction,
  CWBatch       as Batch,
} from './CWTX'
export {
  CWIdentity         as Identity,
  CWSignerIdentity   as SignerIdentity,
  CWMnemonicIdentity as MnemonicIdentity,
  encodeSecp256k1Signature
} from './CWIdentity'
export * from './CWChains'
export * as Staking from './CWStaking'
import { CWChain } from './CWConnection'

export function connect (...args: Parameters<typeof CWChain.connect>) {
  return CWChain.connect(...args)
}
