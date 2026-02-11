import type { Bytes, Fn } from '../library/index.ts';
export const elById  = (id: string) => document.getElementById(id);
export const checked = (id: string) => !!(elById(id) as HTMLInputElement)?.checked;
export const textVal = (id: string) => (elById(id) as HTMLInputElement)?.value?.trim();
export const byteVal = (id: string) => (elById(id) as HTMLInputElement)?.value?.trim() as unknown as Bytes; // FIXME
export const on = (x: EventTarget, ev: string, cb: Fn) => { x?.addEventListener(ev, cb); return cb; }
export const Icon = (name: string) => ['svg.icon', [`use[href=icons.svg#${name}]`]];
export const Link = (href: string, ...text: unknown[]) => ['a[target=_blank]', { href }, ...text];
export function pinSize <T> (el: HTMLElement, cb: Fn<[number, number], T>) {
  const { offsetWidth: width, offsetHeight: height } = el;
  el.style.width  = String(width);
  el.style.height = String(height);
  let result: {ok:T}|{error:Error};
  try {
    result = { ok: cb(width, height) as T };
  } catch (e) {
    result = { error: e };
  }
  el.style = '';
  if ('ok' in result) return result.ok;
  throw result.error;
}
export function download (name: string, type: string, ...parts: unknown[]) {
  const file = new File(parts as BlobPart[], name, { type });
  const url  = URL.createObjectURL(file);
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
