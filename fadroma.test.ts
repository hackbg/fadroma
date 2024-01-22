/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['agent',   () => import('./agent/agent.test')],
  ['compile', () => import('./compile/compile.test')],
  ['create',  () => import('./create/create.test')],
  ['devnet',  () => import('./devnet/devnet.test')],
  ['stores',  () => import('./stores.test')],
  ['scrt',    () =>
    //@ts-ignore
    import('./scrt/scrt.test')],
  ['cw',      () =>
    //@ts-ignore
    import('./cw/cw.test')],
  //['oci',     () =>
    //@ts-ignore
    //import('./oci/oci.test')],
])
