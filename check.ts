#!/usr/bin/env -S deno run --allow-read --allow-run --allow-env --allow-import
import { Watch as $ } from './@hackbg/fadroma/index.ts';
export default $.entrypoint(import.meta, $.typecheck);
