/** Create a DOM tree in a DocumentFragment. */
export function DOM (...args: unknown[]): DocumentFragment {
  // Canonical input form is one or more nested tuples at top:
  // `DOM('div', 'content', [...]) -> `DOM(['div', 'content', [...]])`
  if (args[0] && !args[0][Symbol.iterator]) return DOM(args);
  // Collect elements:
  const frag = new DocumentFragment();
  for (const arg of args) domAdd(frag, arg);
  return frag;
}

function domAdd (frag, arg) {
  // Falsy args are skipped.
  if (!arg) return;
  // Non-tuples shouldn't be here.
  if (!arg[Symbol.iterator]) throw new Error(`DOM: non-tuple: ${arg}`);
  // Each tuple is an S-expression:
  const [spec, ...props] = arg as [string, ...unknown[]];
  // The first member of the tuple describes the element:
  if (typeof arg[0] !== 'string') throw new Error(`DOM: non-string: ${arg[0]}`);
  const { tag, id, attrs = {}, classes = [] } = domParse(spec);
  // SVG must be handled in separate namespace:
  if (tag === 'svg') {
    const svg = SVG(arg);
    frag.appendChild(svg.firstChild);
    return;
  }
  // Create element with attributes:
  const el = domAttrs(document.createElement(tag), attrs);
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
      if (prop[Symbol.iterator]) {
        // Iterables are added as nested DOM tuples:
        el.appendChild(DOM(prop));
      } else {
        // Non-iterables are merged onto the element:
        for (const [k, v] of Object.entries(prop)) {
          el[k] = v;
        }
      }
    } else if (prop) {
      // Other types here are invalid:
      throw new Error(`DOM: invalid prop: ${prop}`);
    }
  }
  frag.appendChild(el);
}

// Properly set element attributes.
function domAttrs (element: Element, attributes: Record<string, string>) {
  // Wrap each KV pair into attribute node:
  for (const [k, v] of Object.entries(attributes)) {
    const attr = Object.assign(document.createAttribute(k), { value: v });
    // Assign it to the element:
    element.attributes.setNamedItem(attr);
  }
  return element;
}

/** Create a SVG tree in a DocumentFragment.
  *
  * This mirrors the logic of DOM but in the SVG namespace.
  * TODO: Abstract. */
export function SVG (...args: unknown[]): SVGSVGElement {
  if (args[0] && !args[0][Symbol.iterator]) return SVG(args);
  const frag = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const arg of args) svgAdd(frag, arg);
  return frag;
}

function svgAdd (frag, arg) {
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

const RE_TAG   = /^[\w-]+/;       // Tag name in kebab-case.
const RE_ID    = /^#[\.?\w-:/]+/; // May begin with `.` to match dotfile names.
const RE_CLASS = /^\.[\w-:/]+/;   // Class name.
const RE_ATTR  = /\[([^\[]+?)(=[^\[]+?)?\]/; // Attribute in square brackets.
function domParse (el: string) {
  const [ tag ] = el.match(RE_TAG);
  el = el.slice(tag.length);
  let id = null;
  const classes = [];
  const attrs = {};
  while (el.length > 0) {
    let match;
    match = el.match(RE_ID);
    if (match) {
      if (id !== null) throw new Error(`DOM: duplicate id: ${match[0]}`);
      id = match[0];
      el = el.slice(match[0].length);
      continue
    }
    match = el.match(RE_CLASS);
    if (match) {
      classes.push(match[0].slice(1));
      el = el.slice(match[0].length);
      continue
    }
    match = el.match(RE_ATTR);
    if (match) {
      const [k, v] = match[0].slice(1, -1).split('=');
      attrs[k] = v;
      el = el.slice(match[0].length);
      continue
    }
    throw new Error(`DOM: invalid: ${el}`)
  }
  return { tag, id, classes, attrs }
}
