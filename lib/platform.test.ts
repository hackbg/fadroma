#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run --allow-import --allow-read --allow-write=/tmp/fadroma
import { Test } from "./index.ts";
import Btc      from "./platform/Bitcoin.test.ts";
import Simf     from "./platform/SimplicityHL.test.ts";
export default Test(import.meta, 'Platform', Btc, Simf);
