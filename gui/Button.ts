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
    view    = Html(['label', label, ['div.row.gap', button, input]])
  } = {}) {
    view.querySelector('button').onclick = compile;
    return { view }
    function compile () {
      console.log('compile', document.querySelector('.pick-progam')?.value)
    }
  }

}
