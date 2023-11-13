/**
  Fadroma Connect. Copyright (C) 2023 Hack.bg. Licensed under GNU AGPLv3 or exception.
  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/
import { Suite } from '@hackbg/ensuite'
export default new Suite([

  ['scrt',   () =>
    //@ts-ignore
    import('./scrt/scrt.test')],

  ['cw',     () =>
    //@ts-ignore
    import('./cw/cw.test')],

])
