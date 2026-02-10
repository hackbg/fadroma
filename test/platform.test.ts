#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run --allow-import --allow-read --allow-write=/tmp/fadroma
import Test         from "../library/Test.ts";
import Bitcoin      from "../platform/Bitcoin/Bitcoin.test.ts";
import SimplicityHL from "../platform/SimplicityHL/SimplicityHL.test.ts";
export default Test(import.meta, 'Platform', Bitcoin, SimplicityHL);
