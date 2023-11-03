/** Fadroma. Copyright (C) 2023 Hack.bg. License: GNU AGPLv3 or custom.
    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <http://www.gnu.org/licenses/>. **/
import { Suite } from '@hackbg/ensuite'
export default new Suite([
  ['agent',   () => import('./agent/agent.test')],
  ['build',   () => import('./ops/build.test')],
  ['devnets', () => import('./ops/devnets.test')],
  ['project', () => import('./ops/project.test')],
  ['prompts', () => import('./ops/prompts.test')],
  ['stores',  () => import('./ops/stores.test')],
  ['tools',   () => import('./ops/tools.test')],
  ['connect', () => import('./connect/connect.test')],
  //['wizard',  () => import('./ops/wizard.test')],
  //['factory', () => import ('./Factory.spec.ts.md')],
  //['impl',    () => import('./Implementing.spec.ts.md')],
])
