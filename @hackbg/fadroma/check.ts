#!/usr/bin/env -S deno run --allow-read --allow-run --allow-env --allow-import
import { setTimeout, clearTimeout } from 'node:timers';
import { entrypoint, call, orange, bold, gray, blue, wordWrap } from './index.ts';
import { stdout, execImpl, stripVTControlCharacters, watchFs } from './deps.ts';
const RE = /(TS\d+)(.+)\n[\s\S]+? at (file:\/\/\/.+\n)/gm;
const decoder = new TextDecoder();
entrypoint(import.meta, main);
async function main (argv) {
  console.log({argv});
  let timer = null;
  const interval = 100;
  await update({ paths: [''] });
  await receive(watchFs("."), update);
  async function update ({ kind, paths = [] } = {}) {
    if (kind === 'access') return;
    console.log(`\x1b[1;1H\x1b[0K`, blue(bold(kind)+' '+paths.map(blue).join(', ')));
    paths = paths
      .filter(x=>!x.endsWith('~'))
      .filter(x=>!x.includes('/.git/'))
      .filter(x=>!x.includes('/.deno.lock'))
      .filter(x=>!x.includes('/node_modules/'));
    if (paths.length === 0) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(call(typecheck, kind, paths), interval);
  }
}
async function typecheck (kind, paths) {
  try {
    const ran = await execImpl('deno', ["check", "index.ts"], { stdio: 'inherit', })
    console.clear();
    const out = await ran.output();
    console.log(decoder.decode(out))
  } catch (e) {
    console.clear();
    e.message = stripVTControlCharacters(e.message)
    const files = {};
    for (const [_, code, error, at] of e.message.matchAll(RE)) {
      const [_, file, line, column] = at.split(':');
      files[file] ??= [];
      files[file].push({ code, error, line, column });
    }
    let checks = 0;
    for (const file of Object.keys(files).sort()) {
      if (files[file].length > 0) {
        console.log(orange(bold(file)), `(${files[file].length})`);
        for (const { code, error, line, column } of files[file]) {
          const line0 = error.trim().split('\n')[0];
          const msg = wordWrap('                '+line0, {
            width: stdout.columns-10,
            indent: '         '
          }).trim();
          console.log(`${bold(String(line).padStart(4, '0'))}:${column.trim().padStart(3, '0')} ${orange(code.trim())} ${gray(4, msg.trim().replace('[ERROR]: ', ''))}`);
          checks++;
        }
        console.log()
      }
    }
    console.log(` ${checks} check(s) to go`);
  }
}
async function receive (iter, handler) {
  for await (const event of iter) await handler(event);
}
