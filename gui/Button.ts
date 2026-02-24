import Html from '../library/Html.ts';
import Icon from './Icon.ts';

export default Button;

function Button () { /* TODO */ }

namespace Button {

  export function Command (icon: string|null, ...content: unknown[]) {
    return [ 'div.command', icon && Icon(icon), ...content ]
  }

  export function Compile ({
    label   = Html(['strong', 'Program address:']),
    button  = Html(['button', 'Compile', { style: 'padding:0 1rem; border: 1px solid #af48' }]),
    input   = Html(['input']),
    view    = Html(['label', label, ['div.row.gap', button, input]]).firstChild,
    chain   = 'liquidtestnet' as const,
    genesis = 'a771da8e52ee6ad581ed1e9a99825e5b3b7992225534eaa2ae23244fe26ab1c1',
  } = {}) {
    view.querySelector('button').onclick = compile;
    return { view }
    async function compile () {
      const { default: Wasm } = await import('./Wasm.ts');
      const compiler = Wasm.compiler({ chain, genesis });
      const program = compiler.compile(`fn main () {}`);
      const address = program.toJSON().p2tr;
      view.querySelector('input').value = address;
    }
  }

  export function Commit ({
    view = Html(['label', ['strong', 'Commit TX:'],       ['button', 'Commit']]).firstChild
  } = {}) {
    return { view }
  }

}
