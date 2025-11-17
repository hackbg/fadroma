/** Create a DOM tree in a DocumentFragment. */
export function DOM (...args: unknown[]): DocumentFragment {
  if (typeof args[0] === 'string') return DOM(args);
  const frag = new DocumentFragment();
  for (const arg of args) {
    if (!arg[Symbol.iterator]) throw new Error('DOM: invalid');
    const [spec, ...props] = arg as [string, ...unknown[]];
    const { tag, id, attrs = {}, classes = [] } = domParse(spec);
    const el = document.createElement(tag);
    if (id) el.id = id;
    for (const c of classes) el.classList.add(c);
    for (const [k, v] of Object.entries(attrs)) {
      const attr = Object.assign(document.createAttribute(k), { value: v });
      el.attributes.setNamedItem(attr);
    }
    for (const prop of props) {
      if (typeof prop === 'string') {
        const text = document.createTextNode(prop);
        el.appendChild(text);
      } else if (typeof prop === 'object') {
        if (prop[Symbol.iterator]) {
          el.appendChild(DOM(prop));
        } else {
          for (const [k, v] of Object.entries(props)) {
            el[k] = v;
          }
        }
      } else if (prop) {
        throw new Error(`DOM: invalid: ${prop}`);
      }
    }
    frag.appendChild(el);
  }
  return frag;
}

const RE_TAG   = /^[\w-]+/;
const RE_ID    = /^#[\w-:/]+/;
const RE_CLASS = /^\.[\w-:/]+/;
const RE_ATTR  = /\[([^\[]+?)(=[^\[]+?)?\]/;
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
      if (id === null) {
        id = match[0];
      } else {
        throw new Error(`DOM: duplicate id: ${match[0]}`)
      }
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
  console.log(tag, id, classes, attrs);
  return { tag, id, classes, attrs }
}
