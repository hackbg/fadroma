#!/usr/bin/env -S deno run --coverage --allow-env --allow-net --allow-run --allow-import --allow-read --allow-write=/tmp/fadroma
import { Test } from "./index.ts";
import Codegen from './context/codegen.test.ts';
import CLI     from './context/command.test.ts';
import DOM     from './context/dom.test.ts';
import FS      from './context/fs.test.ts';
import HTTP    from './context/http.test.ts';
import Log     from './context/log.test.ts';
import OCI     from './context/oci.test.ts';
import Port    from './context/port.test.ts';
import Service from './context/service.test.ts';
import TCP     from './context/tcp.test.ts';
import Tester  from './context/tester.test.ts';
import TUI     from './context/tui.test.ts';
export default Test.suite(import.meta, 'Contexts',
  Codegen, CLI, DOM, FS, HTTP, Log, OCI, Port, Service, TCP, Tester, TUI);
