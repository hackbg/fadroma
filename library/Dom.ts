// TODO: abstract shared logic between html and svg here

globalThis.DocumentFragment ??= class {} as unknown as typeof DocumentFragment;

// Properly set element attributes.
export function domAttrs (element: Element, attributes: Record<string, string>) {
  // Wrap each KV pair into attribute node:
  for (const [k, v] of Object.entries(attributes)) {
    const attr = Object.assign(document.createAttribute(k), { value: v });
    // Assign it to the element:
    element.attributes.setNamedItem(attr);
  }
  return element;
}

const RE_TAG   = /^[\w-]+/;       // Tag name in kebab-case.
const RE_ID    = /^#[\.?\w-:/]+/; // May begin with `.` to match dotfile names.
const RE_CLASS = /^\.[\w-:/]+/;   // Class name.
const RE_ATTR  = /\[([^\[]+?)(=[^\[]+?)?\]/; // Attribute in square brackets.
export function domParse (el: string) {
  const [ tag ] = el.match(RE_TAG);
  el = el.slice(tag.length);
  let id = null;
  const classes = [];
  const attrs = {};
  while (el.length > 0) {
    let match: RegExpMatchArray;
    match = el.match(RE_ID);
    if (match) {
      if (id !== null) throw new Error(`DOM: duplicate id: ${match[0]}`);
      id = match[0].slice(1);
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
