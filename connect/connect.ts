/**
  Fadroma Connect
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

import { Console, Error, Agent, Mode, ChainId, bold } from '@fadroma/agent'
import * as Scrt from '@fadroma/scrt'
import * as CW from '@fadroma/cw'
import { Config } from '@hackbg/conf'
import type { Environment } from '@hackbg/conf'
export * from '@hackbg/conf'
export * from '@fadroma/agent'
export { Scrt, CW }

/** Connection configuration. Factory for `Chain` and `Agent` objects. */
export class ConnectConfig extends Config {
  /** Secret Network configuration. */
  scrt: Scrt.Config
  /** OKP4 configuration. */
  okp4: CW.OKP4.Config

  constructor (options: Partial<ConnectConfig> & Partial<{
    scrt: Partial<Scrt.Config>, okp4: Partial<CW.OKP4.Config>
  }> = {}, environment?: Environment) {
    super(environment)
    this.override(options)
    this.scrt = new Scrt.Config(options?.scrt, environment)
    this.okp4 = new CW.OKP4.Config(options?.okp4, environment)
  }
}
