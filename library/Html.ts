import Fn from './Fn.ts';
import Svg from './Svg.ts';
import { domAttrs, domParse } from './Dom.ts';

export default Html;

/** Render a DOM tree into a DocumentFragment. */
function Html (...args: unknown[]): DocumentFragment {
  // Canonical input form is one or more nested tuples at top:
  // `DOM('div', 'content', [...]) -> `DOM(['div', 'content', [...]])`
  if (args[0] && !args[0][Symbol.iterator]) return Html(args);
  // Collect elements:
  const frag = new DocumentFragment();
  for (const arg of args) Html.add(frag, arg);
  return frag;
}

namespace Html {

  export function id <T extends HTMLElement> (id: string): T {
    return document.getElementById(id) as T
  }

  export function clear <T extends HTMLElement> (el: T): T {
    el.innerHTML = '';
    return el
  }

  export function on (x: EventTarget, ev: string, cb: Fn) {
    x?.addEventListener(ev, cb);
    return cb;
  }

  export function append (el: Node, ...els: Node[]) {
    for (const e of els) el.appendChild(e);
    return el;
  }

  export function replace (el: Node, ...els: Node[]) {
    const frag = new DocumentFragment();
    for (const nel of els) frag.appendChild(nel);
    if (el.parentElement) el.parentElement.replaceChild(frag, el);
    return frag;
  }

  export function prepend (el: Node, ...els: Node[]) {
    const frag = Html()
    for (const e of els) frag.appendChild(e);
    el.insertBefore(frag, el.firstChild);
    return el;
  }

  export function add (frag: DocumentFragment, arg: unknown) {
    const el = Html.el(arg);
    if (el) frag.appendChild(el);
    return el;
  }

  export function el (arg: unknown): HTMLElement {
    // Falsy args are skipped.
    if (!arg) return;
    // Non-tuples shouldn't be here.
    if (!arg[Symbol.iterator]) throw new Error(`Html: non-tuple: ${arg}`);
    // Each tuple is an S-expression:
    const [spec, ...props] = arg as [string, ...unknown[]];
    // The first member of the tuple describes the element:
    if (typeof arg[0] !== 'string') throw new Error(`Html: non-string: ${arg[0]}`);
    const { tag, id, attrs = {}, classes = [] } = domParse(spec);
    // SVG must be handled in separate namespace:
    if (tag === 'svg') return Svg(arg).firstChild as HTMLElement;
    // Create element with attributes:
    let el = domAttrs(document.createElement(tag), attrs) as HTMLElement;
    // Desugar #id and .class:
    if (id) el.id = id;
    for (const c of classes) el.classList.add(c);
    // Remaining members of tuple add to the element:
    for (const prop of props) {
      // Falsy props are skipped.
      if (!prop) continue;
      if (typeof prop === 'string') {
        // Strings are added as text nodes:
        el.appendChild(document.createTextNode(prop));
      } else if (typeof prop === 'object') {
        if (prop instanceof Node) {
          el.appendChild(prop);
        } else if (prop[Symbol.iterator]) {
          // Iterables are added as nested DOM tuples:
          el.appendChild(Html(prop));
        } else {
          // Non-iterables are merged onto the element:
          for (const [k, v] of Object.entries(prop)) {
            el[k] = v;
          }
        }
      } else if (typeof prop === 'function') {
        el = prop(el) ?? el;
      } else if (prop) {
        // Other types here are invalid:
        throw new Error(`DOM: invalid prop: ${prop}`);
      }
    }
    return el;
  }

};

export function Div (spec: string, ...args: unknown[]) {
  return Html([`div${spec}`, ...args]).firstChild as HTMLDivElement
}
export function Section (...content: unknown[]) {
  return Html(['section', ...content]).firstChild as HTMLElement;
}
export function Label (...content: unknown[]) {
  return Html(['label', ...content]).firstChild as HTMLLabelElement
}
export function Input (...args: unknown[]) {
  return Html(['input', ...args]).firstChild as HTMLInputElement;
}
export function Button (onclick = null, ...content: unknown[]) {
  return Html(['button', { onclick }, ...content]).firstChild as HTMLButtonElement; // FIXME don't default to DocumentFragment
}
export function Option (value?: unknown, ...content: unknown[]) {
  return Html(['option', { value }, ...content]).firstChild as HTMLOptionElement
}
