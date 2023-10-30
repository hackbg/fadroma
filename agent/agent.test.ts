/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['base',     ()=>import('./base.test')],
  ['batch',    ()=>import('./batch.test')],
  ['chain',    ()=>import('./chain.test')],
  ['client',   ()=>import('./client.test')],
  ['contract', ()=>import('./code.test')],
  ['deploy',   ()=>import('./deploy.test')],
  ['store',    ()=>import('./store.test')],
  ['token',    ()=>import('./token.test')]
])
