import type { Meta } from '../index.ts';
import type { ChildProcess } from '../deps.ts';
import { Fn, wordWrap, msec, entrypoint as entry } from '../format.ts';
import { orange, bold, gray, blue, yellow } from '../format/ansi.ts';
import { cwd, resolvePath, stdout, stderr, watchFs,
  execFile, stripVTControlCharacters, execImpl } from '../deps.ts';
/** Run a test suite on file update. */
export async function runTest (_kind: string, _paths: string[], ...args: unknown[]) {
  if (args.length === 0) args[0] = './test.ts';
  try {
    const run: ChildProcess = await runPipe(args);
    await waitEnd(run);
  } catch (e) {
    console.error(e);
  }
}
function runPipe (args): Promise<ChildProcess> {
  return new Promise((resolve, reject)=>{
    const run = execFile(args[0] as string);
    run.once('error', reject);
    run.once('spawn', () => {
      run.stdout.pipe(stdout);
      run.stderr.pipe(stderr);
      resolve(run); run.off('error', reject);
    });
  })
}
function waitEnd (run) {
  return new Promise((resolve, reject)=>{
    run.once('error', reject);
    run.once('close', () => { resolve(null); run.off('error', reject); });
  });
}
