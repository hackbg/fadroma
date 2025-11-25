import { wordWrap } from '../format.ts';
import { orange, bold, gray, yellow } from '../format/ansi.ts';
import { stdout, stripVTControlCharacters, execImpl } from '../deps.ts';
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
