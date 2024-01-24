/** Fadroma Devnet. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Suite } from '@hackbg/ensuite'
import { testDevnetPlatform } from './devnet-base.test'
export default new Suite([
  ['impl', () => import('./devnet-impl.test')],
  ['scrt', () => testDevnetPlatform('Scrt', '1.12')],
  ['okp4', () => testDevnetPlatform('OKP4', '6.0')],
  ['archway', () => testDevnetPlatform('Archway', '4.0.3')],
  ['osmosis', () => testDevnetPlatform('Osmosis', '22.0.1')],
  ['injective', () => testDevnetPlatform('Injective', '1.12.9-testnet')],
])
