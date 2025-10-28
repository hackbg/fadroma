#!/usr/bin/env -S deno run --allow-read --allow-run --allow-env --allow-import
import { setTimeout, clearTimeout } from 'node:timers';
import { entrypoint, call } from './index.ts';
import { execImpl } from './@hackbg/fadroma/deps.ts';
const decoder = new TextDecoder();
entrypoint(import.meta, main);
async function main (argv) {
  console.log({argv});
  let timer = null;
  const interval = 100;
  await update({ paths: [''] });
  await receive(Deno.watchFs("."), update);
  async function update ({ kind, paths = [] } = {}) {
    if (kind === 'access') return;
    paths = paths
      .filter(x=>!x.endsWith('~'))
      .filter(x=>!x.includes('/node_modules/'))
      .filter(x=>!x.includes('/.git/'))
      .filter(x=>!x.includes('/.deno.lock'));
    if (paths.length === 0) return;
    console.log(kind, ...paths);
    if (timer) clearTimeout(timer);
    timer = setTimeout(call(typecheck, kind, paths), interval);
  }
}
async function typecheck (kind, paths) {
  try {
    const ran = await execImpl('deno', ["check", "index.ts"], { stdio: 'inherit', })
    console.clear();
    console.log(kind, ...paths);
    console.log({ran});
    const out = await ran.output();
    console.log(decoder.decode(out))
  } catch (e) {

    console.clear();
    console.log(kind, ...paths);
    console.error(e.message);
  }
}
async function receive (iter, handler) {
  for await (const event of iter) await handler(event);
}
