/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import type { ChainClass } from '@fadroma/connect'
import { connectModes, CW, Scrt } from '@fadroma/connect'
import { Config } from './ops/config'

// Install devnets as selectable chains:
Object.assign(connectModes, {

  'ScrtDevnet': Scrt.Chain.devnet =
    (options: Partial<Scrt.Chain>|undefined): Scrt.Chain =>
      new Config().devnet
        .getDevnet({ platform: 'scrt_1.9' })
        .getChain(Scrt.Chain as ChainClass<Scrt.Chain>, options),

  'OKP4Devnet': CW.OKP4.Chain.devnet = 
    (options: Partial<CW.OKP4.Chain>|undefined): CW.OKP4.Chain =>
      new Config().devnet
        .getDevnet({ platform: 'okp4_5.0' })
        .getChain(CW.OKP4.Chain as ChainClass<CW.OKP4.Chain>, options)

})

export * from '@fadroma/connect'
export * from './ops/build'
export * from './ops/config'
export * from './ops/deploy'
export * from './ops/devnet'
export * from './ops/project'
export * from './ops/upload'
export * from './ops/wizard'
export { Config } from './ops/config'
