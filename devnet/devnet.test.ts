/** Fadroma Devnet. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Suite } from '@hackbg/ensuite'
import { Token } from '@fadroma/agent'
import { testDevnetPlatform } from './devnet-base.test'
import { ScrtContainer, OKP4Container } from './devnet-base'
import { ScrtConnection } from '@fadroma/scrt'
import { OKP4Connection } from '@fadroma/cw'

export default new Suite([

  ['impl', () => import('./devnet-impl.test')],

  ['scrt', () => testDevnetPlatform(
    ScrtConnection,
    ScrtContainer,
    '1.12',
    'secretd',
    new Token.Native('uscrt')
  )],

  ['okp4', () => testDevnetPlatform(
    OKP4Connection,
    OKP4Container,
    '6.0',
    'okp4d',
    new Token.Native('uknow')
  )],

])
