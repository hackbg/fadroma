import Fn from './Fn.ts';
import Main from './Main.ts';
import { cwd, stdout, stderr } from 'node:process'
import { stripVTControlCharacters } from 'node:util'
import { msec } from './Time.ts';
import { bold, blue, orange, gray, yellow } from './Ansi.ts';
import { wordWrap } from './Str.ts';
import type { ChildProcess } from '../deps.ts';
import { resolvePath, realpathSync, watchFs, execImpl, execFile } from '../deps.ts';

/** Entrypoint that reruns on file change. */
export const entrypoint = function watchEntrypoint (
  meta: Main.Meta, mode: Fn<[string, string[]]>, ...options: unknown[]
) {
  return Main(meta, Fn(watch, mode, options||[]))
};

const toRealPath = (x: string) => {
  try { return realpathSync(x) } catch (e) { if (e.code!=='ENOENT') throw e }
};

const toRelativePath = (cwd: string) => (x: string) => {
  return resolvePath(x).replace(cwd, '.');
};

/** Run a watcher function. */
export async function watch (mode: Fn<[string, string[]]>, options: unknown[]) {
  // todo: make configurable
  // debounce timer
  let timer = null;
  // debounce interval
  const interval = 100;
  // initial run
  await update({ force: true });
  // update on every event
  for await (const event of watchFs(".")) await update(event);
  // main update function
  async function update ({
    force = false, kind = null, paths = [],
    filter = (x: string = '') => !(
      (!x)||
      (x.length===0)||
      x.endsWith('~')||
      x.includes('/.git/')||
      x.includes('/toolbox/')||
      x.includes('/coverage/')||
      x.includes('/.deno.lock')||
      x.includes('/.direnv/')||
      x.includes('/node_modules/.deno')
    ),
  } = {}) {
    
    // non-forced updates go through the debounce
    if (!force) {
      // ignore access events; todo: configurable
      if (kind === 'access') return;
      // ignore paths we don't care about
      paths = paths.map(toRealPath).filter(filter).map(x=>x.trim());
      // skip if only ignored paths were updated
      if (paths.length === 0) return;
      // convert paths to relative and filter again
      paths = paths.filter(Boolean).map(toRelativePath(cwd()));
      // log update at bottom left corner
      stdout.write(blue(bold(kind) + ' ' + paths.join(', ').slice(0, stdout.columns)));
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      const t0 = performance.now();
      try {
        await mode(kind, paths, ...options)
      } finally {
        stdout.write(
          `\x1b[${stdout.rows||1};${1}H` +
          blue('Waiting for changes in ' + bold(cwd())) +
          `\x1b[${stdout.rows||1};1H` +
          `\x1b[${Math.max(0, stdout.columns - 10)}G` +
          blue(msec(performance.now() - t0)));
      }
    }, force ? 0 : interval);
  }
}

/** Regular expression to extraxt TS???? errors from TSC output. */
const RE_TS = /(TS\d+)(.+)\n[\s\S]+? at (file:\/\/\/.+\n)/gm;

/** Run a typecheck on file update. */
export async function denoCheck (
  _event:   string,
  _touched: string[],
  ...args:  string[]
) {
  if (args.length === 0) args = ['index.ts'];
  try {
    stdout.write('\x1b[3J');
    stdout.write(`\x1b[${stdout.rows||1};1H` + `\x1b[0K`);
    stdout.write([`Running`, bold([`deno check -I`, ...args].join(' '))].join(' '));
    const ran = await execImpl('deno', ["check", "-I", ...args]);
    console.log(yellow('stdout:'), ran.stdout);
    console.log(yellow('stderr:'), ran.stderr);
    console.log('🟢 The types check out.');
  } catch (e) {
    console.clear();
    e.message = stripVTControlCharacters(e.message)
    const files = {};
    for (const [_, code, error, at] of e.message.matchAll(RE_TS)) {
      const [_, file, line, column] = at.split(':');
      files[file] ??= [];
      files[file].push({ code, error, line, column });
    }
    let checks = 0;
    const lines = [];
    for (const file of Object.keys(files).sort()) {
      if (files[file].length > 0) {
        lines.push([orange(bold(file)), `(${files[file].length})`]);
        for (const { code, error, line, column } of files[file]) {
          const line0   = error.trim().split('\n')[0];
          const space   = '                ';
          const indent  = '         ';
          const options = { indent, width: stdout.columns - 10 };
          const msg     = wordWrap(space + line0, options).trim();
          lines.push([`${bold(String(line).padStart(4, '0'))}:` +
            `${column.trim().padStart(3, '0')} ${orange(code.trim())} ` +
            `${gray(4, msg.trim().replace('[ERROR]: ', ''))}`]);
          checks++;
        }
        lines.push()
      }
    }
    for (const line of lines) console.log(...line);
    console.log(` ${checks} check(s) to go`);
  }
}

/** Run a test suite on file update. */
export async function runTest (_kind: string, _paths: string[], ...args: string[]) {
  if (args.length === 0) args[0] = './test.ts';
  try {
    const run: ChildProcess = await runPipe(args);
    await waitEnd(run);
  } catch (e) {
    console.error(e);
  }
}

function runPipe (args: string[]): Promise<ChildProcess> {
  return new Promise((resolve, reject)=>{
    const run = execFile(args[0]);
    run.once('error', reject);
    run.once('spawn', () => {
      run.stdout.pipe(stdout);
      run.stderr.pipe(stderr);
      resolve(run); run.off('error', reject);
    });
  })
}

function waitEnd (run: {
  once (_: string, __: Fn): unknown;
  off  (_: string, __: Fn): unknown;
}) {
  return new Promise((resolve, reject)=>{
    run.once('error', reject);
    run.once('close', () => {
      resolve(null);
      run.off('error', reject);
    });
  });
}
