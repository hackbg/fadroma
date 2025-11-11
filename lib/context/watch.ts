import type { Meta } from '../index.ts';
import type { ChildProcess } from '../deps.ts';
import { Fn, wordWrap, msec, entrypoint as entry } from '../format.ts';
import { orange, bold, gray, blue, yellow } from '../format/ansi.ts';
import { getCwd, resolvePath, realpathSync, stdout, stderr, watchFs,
  execFile, stripVTControlCharacters, execImpl } from '../deps.ts';
const RE = /(TS\d+)(.+)\n[\s\S]+? at (file:\/\/\/.+\n)/gm;
const decoder = new TextDecoder();
/** Entrypoint that reruns on file change. */
export const entrypoint = function watchEntrypoint (
  meta: Meta,
  mode: Fn<[string, string[]]>,
  ...options: unknown[]
) {
  return entry(meta, Fn(watch, mode, options||[]))
};
const toRealPath = (x: string) => { try { return realpathSync(x) } catch (e) { if (e.code!=='ENOENT') throw e } };
const toRelativePath = (cwd: string) => (x: string) => resolvePath(x).replace(cwd, '.');
/** Run a watcher function. */
export async function watch (callback: Fn<[string, string[]]>, options: unknown[]) {
  // todo: make configurable
  const cwd = getCwd();
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
    filter = (x: string) => !(
      x.endsWith('~')||
      x.includes('/.git/')||
      x.includes('/toolbox/')||
      x.includes('/coverage/')||
      x.includes('/.deno.lock')||
      x.includes('/node_modules/.deno/')
    ),
  } = {}) {
    // non-forced updates go through the debounce
    if (!force) {
      // ignore access events; todo: configurable
      if (kind === 'access') return;
      // ignore paths we don't care about
      paths = paths.filter(filter);
      // skip if only ignored paths were updated
      if (paths.length === 0) return;
      // convert paths to relative and filter again
      paths = paths.map(toRealPath).filter(Boolean).map(toRelativePath(cwd));
      // log update at bottom left corner
      stdout.write(`\x1b[${stdout.rows||1};1H` + `\x1b[0K`
        + blue(bold(kind) + ' ' + paths.join(', ').slice(0, stdout.columns)));
    }
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      const t0 = performance.now();
      try {
        await callback(kind, paths, ...options)
      } finally {
        stdout.write(
          `\x1b[${stdout.rows||1};${1}H` + blue('waiting for changes') +
          `\x1b[${stdout.rows||1};1H` +
          `\x1b[${Math.max(0, stdout.columns - 10)}G` +
          blue(msec(performance.now() - t0)));
      }
    }, force ? 0 : interval);
  }
}
/** Run a typecheck on file update. */
export async function typecheck (kind: string, paths: string[], args: unknown[] = []) {
  if (args.length === 0) args[0] = 'index.ts';
  try {
    const ran = await execImpl('deno', ["check", "-I", "index.ts"]);
    console.clear();
    console.log(yellow('stdout:'), ran.stdout);
    console.log(yellow('stderr:'), ran.stderr);
    console.log('🟢 The types check out.');
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
export async function test (_kind: string, _paths: string[], args: unknown[]) {
  if (args.length === 0) args[0] = './test.ts';
  try {
    const run: ChildProcess = await new Promise((resolve, reject)=>{
      const run = execFile(args[0] as string);
      run.once('error', reject);
      run.once('spawn', () => {
        run.stdout.pipe(stdout);
        run.stderr.pipe(stderr);
        resolve(run); run.off('error', reject);
      });
    });
    await new Promise((resolve, reject)=>{
      run.once('error', reject);
      run.once('close', () => { resolve(null); run.off('error', reject); });
    })
  } catch (e) {
    console.error(e);
  }
};
