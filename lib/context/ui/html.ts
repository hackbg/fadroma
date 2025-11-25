import { domAttrs, domParse } from './dom.ts';
import { Svg } from './svg.ts';

/** Create a DOM tree in a DocumentFragment. */
export const Html = Object.assign(
  function Html (...args: unknown[]): DocumentFragment {
    // Canonical input form is one or more nested tuples at top:
    // `DOM('div', 'content', [...]) -> `DOM(['div', 'content', [...]])`
    if (args[0] && !args[0][Symbol.iterator]) return Html(args);
    // Collect elements:
    const frag = new DocumentFragment();
    for (const arg of args) htmlAdd(frag, arg);
    return frag;
  }, {
    append (el: Node, ...els: Node[]) {
      for (const e of els) el.appendChild(e);
      //el.appendChild(DOM(...els));
      return el;
    }
  });

function htmlAdd (frag: DocumentFragment, arg: unknown) {
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
  if (tag === 'svg') {
    const svg = Svg(arg);
    frag.appendChild(svg.firstChild);
    return;
  }
  // Create element with attributes:
  let el = domAttrs(document.createElement(tag), attrs);
  // Desugar #id and .class:
  if (id) el.id = id;
  for (const c of classes) el.classList.add(c);
  // Remaining members of tuple add to the element:
  for (const prop of props) {
    // Falsy props are skipped.
    if (!prop) return;
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
  frag.appendChild(el);
}
