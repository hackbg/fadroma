#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run --allow-import --allow-read --allow-write=/tmp/fadroma
import { Test } from "./index.ts";
import Btc from "./platform/btc.test.ts";
import Simf from "./platform/simf.test.ts";
export default Test(import.meta, 'Platform', Btc, Simf);
