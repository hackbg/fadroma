//import { Dir } from './context.ts';
//console.log({Dir});
globalThis.process.stderr = {};
globalThis.process.stdin  = {};
globalThis.process.stdout = {};

import { Dir, Zip, Project } from './index.ts';

const elById  = (id: string) => document.getElementById(id);
const checked = (id: string) => !!(elById(id) as HTMLInputElement)?.checked;
const on = (x: EventTarget, ev, cb) => { x?.addEventListener(ev, cb); return cb; }

on(elById("toolbar"), "change", async function onToolbarChange (e) {
  console.log(e.target);
});

on(elById("download"), "click", async function generateProject () {
  const title   = elById('title').value.trim();
  const readme  = elById('readme').value.trim();
  const license = elById('license').value;
  const project = Zip(Project(title, {
    readme,
    license,
    btc:    checked('enable-btc'),
    simf:   checked('enable-simf'),
    deno:   checked('enable-deno'),
    node:   checked('enable-node'),
    pnpm:   checked('enable-pnpm'),
    eslint: checked('enable-eslint'),
    nix:    checked('enable-nix'),
    direnv: checked('enable-direnv'),
  }));
  console.log({project});
});
