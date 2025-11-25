import { domAttrs, domParse } from './dom.ts';

/** Create a SVG tree in a DocumentFragment.
  *
  * This mirrors the logic of DOM but in the SVG namespace.
  * TODO: Abstract. */
export function Svg (...args: unknown[]): SVGSVGElement {
  if (args[0] && !args[0][Symbol.iterator]) return SVG(args);
  const frag = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const arg of args) svgAdd(frag, arg);
  return frag;
}

function svgAdd (frag: SVGSVGElement, arg: unknown) {
  if (!arg) return;
  if (!arg[Symbol.iterator]) throw new Error(`SVG: non-tuple: ${arg}`);
  const [spec, ...props] = arg as [string, ...unknown[]];
  if (typeof arg[0] !== 'string') throw new Error(`SVG: non-string: ${arg[0]}`);
  const { tag, id, attrs = {}, classes = [] } = domParse(spec);
  const el = domAttrs(document.createElementNS('http://www.w3.org/2000/svg', tag), attrs);
  if (id) el.id = id;
  for (const c of classes) el.classList.add(c);
  for (const prop of props) {
    if (!prop) return;
    if (typeof prop === 'string') {
      el.append(document.createTextNode(prop));
    } else if (typeof prop === 'object') {
      if (prop[Symbol.iterator]) {
        SVG(prop).childNodes.forEach(n=>el.append(n));
      } else {
        for (const [k, v] of Object.entries(prop)) el[k] = v;
      }
    } else if (prop) {
      throw new Error(`SVG: invalid prop: ${prop}`);
    }
  }
  frag.appendChild(el);
}

