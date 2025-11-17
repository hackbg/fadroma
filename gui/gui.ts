import type { Bytes } from '../lib/index.ts';
import { Dir, Zip, Txt, Bin } from '../lib/index.ts';
import { loadDocs } from './docs.ts';
import { updateProject, saveProject } from './gen.ts';

const elById  = (id: string) => document.getElementById(id);
const checked = (id: string) => !!(elById(id) as HTMLInputElement)?.checked;
const textVal = (id: string) => (elById(id) as HTMLInputElement)?.value?.trim();
const byteVal = (id: string) => (elById(id) as HTMLInputElement)?.value?.trim() as unknown as Bytes; // FIXME
const on = (x: EventTarget, ev, cb) => { x?.addEventListener(ev, cb); return cb; }

on(elById("sidebar"),  "change", updateProject);
on(elById("navbar"),   "click",  navbarOnClick);
on(elById("download"), "click",  saveProject);

async function navbarOnClick (e) {
  if (e.target.href) {
    e.preventDefault();
    elById("main").innerHTML = 'loading...';
    fetch(e.target.href)
      .then(response=>response.text())
      .then(loadDocs);
  }
}
