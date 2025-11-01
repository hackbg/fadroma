#!/usr/bin/env -S deno run --allow-read --allow-run --allow-env --allow-import
import { setTimeout, clearTimeout } from 'node:timers';
import { entrypoint, call, ANSI, wordWrap } from './index.ts';
import { getCwd, stdout, execImpl, stripVTControlCharacters, watchFs } from './@hackbg/fadroma/deps.ts';
import { resolve as resolvePath } from 'node:path';
import { realpathSync } from 'node:fs';
import { watch } from './@hackbg/fadroma/watch.ts';
const { orange, bold, gray, blue, } = ANSI;
const RE = /(TS\d+)(.+)\n[\s\S]+? at (file:\/\/\/.+\n)/gm;
const decoder = new TextDecoder();
entrypoint(import.meta, call(watch, typecheck));
async function typecheck (kind, paths) {
  try {
    const ran = await execImpl('deno', ["check", "index.ts"], { stdio: 'inherit', })
    console.clear();
    //console.log(kind, ...paths);
    //console.log({ran});
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
