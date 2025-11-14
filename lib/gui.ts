//import { Dir } from './context.ts';
//console.log({Dir});
globalThis.process.stderr = {};
globalThis.process.stdin  = {};
globalThis.process.stdout = {};

import { Project } from './index.ts';

const elById = x => document.getElementById(x);
const on = (x, ev, cb) => { x?.addEventListener(ev, cb); return cb; }

on(elById("download"), "click", async function generateProject () {
  const title   = elById('title').value.trim();
  const readme  = elById('readme').value.trim();
  const license = elById('license').value;
  const project = Project(title, {
    readme,
    license,
    btc:    elById('enable-btc').checked,
    simf:   elById('enable-simf').checked,
    deno:   elById('enable-deno').checked,
    node:   elById('enable-node').checked,
    pnpm:   elById('enable-pnpm').checked,
    eslint: elById('enable-eslint').checked,
    nix:    elById('enable-nix').checked,
    direnv: elById('enable-direnv').checked,
  })
  console.log({project});
});
