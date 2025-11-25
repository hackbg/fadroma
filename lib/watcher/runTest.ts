import type { ChildProcess } from '../deps.ts';
import type { Fn } from '../index.ts';
import { stdout, stderr, execFile } from '../deps.ts';
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
