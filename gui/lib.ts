import type { Bytes, Fn } from '../lib/index.ts';

export const elById  = (id: string) => document.getElementById(id);

export const checked = (id: string) => !!(elById(id) as HTMLInputElement)?.checked;

export const textVal = (id: string) => (elById(id) as HTMLInputElement)?.value?.trim();

export const byteVal = (id: string) => (elById(id) as HTMLInputElement)?.value?.trim() as unknown as Bytes; // FIXME

export const append  = (el: Node, ...els: Node[]) => { els.forEach(e=>el.appendChild(e)); return el; }

export const on = (x: EventTarget, ev: string, cb: Fn) => { x?.addEventListener(ev, cb); return cb; }

export function Icon (name) {
  return ['svg.icon', [`use[href=icons.svg#${name}]`]];
}

export function Link (href, ...text) {
  return ['a[target=_blank]', { href }, ...text];
}
