#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run --allow-import --allow-read --allow-write=/tmp/fadroma
import { Test } from "./index.ts";
import UI      from './context/ui.test.ts';
import OS      from './context/os.test.ts';
import Net     from './context/net.test.ts';
import Project from './context/project.test.ts';
import Tester  from './context/tester.test.ts';
export default Test.suite(import.meta, 'Context', UI, OS, Net, Project, Tester);
