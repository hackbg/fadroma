set export
BUILDER  := "docker" # podman, buildah...
IMAGE    := "hackbg/fadroma:dev"
JUST     := "time just"
RUN      := "time podman run --rm -v .:/app:rw --workdir=/app -it hackbg/fadroma:dev"
CHECK    := "time deno check --allow-import"
DOC      := "time deno doc"
TEST     := "time deno test"
COV      := "deno coverage"
# Display available recipes.
list:
  @just --list
# Build the environment in which SimplicityHL WASM modules can be compiled.
wasm-img builder="$BUILDER":
  time {{builder}} build -t "{{IMAGE}}" .
# Open WASM build shell to iterate on WASM modules from current checkout.
wasm-sh builder="$BUILDER":
  {{builder}} run -v .:/app:rw --workdir=/app -it "{{IMAGE}}"
# Compile dev builds of all WASM modules.
wasm-all builder="$BUILDER":
  time just wasm-img {{builder}}
  time just wasm {{builder}} SimplicityHL
  time just wasm {{builder}} Namada
# Compile dev builds of SimplicityHL module.
wasm builder="$BUILDER" platform="SimplicityHL":
  time just wasm-img {{builder}}
  time {{builder}} run -v .:/app:rw --workdir=/app -it "{{IMAGE}}" \
    sh -c "cd platform/{{platform}} && just build"
# Typecheck.
check:
  ${CHECK} lib/*.ts
# Typecheck with watcher.
check-watch:
  #!/usr/bin/env -S deno run --allow-run --allow-env --allow-import --allow-read --allow-write=/tmp/fadroma
  import { entrypoint, denoCheck } from '../library/Watch.ts';
  export default entrypoint(import.meta, denoCheck, 'lib/index.test.ts', 'index.ts');
# Generate Deno docs.
doc:
  ${DOC} --html --private --name=@hackbg/fadroma index.ts
# Generate Deno docs with lints.
doc-lint:
  ${DOC} --html --private --lint --name=@hackbg/fadroma index.ts
# Generate patched Deno docs.
doc-patched:
  #!/bin/sh
  set -emu # an invisible one
  OUTPUT="var/docs/deno"
  deno doc -I --html --output="$OUTPUT" lib/index.ts
  cp "$OUTPUT/all_symbols.html" "$OUTPUT/index.html"
  echo '.namespaceItem{min-height:1.5rem !important;width:100%}' >> "$OUTPUT/styles.css"
  echo '.namespaceItemContent{display: flex;flex-flow: row wrap}' >> "$OUTPUT/styles.css"
  echo '.namespaceItemContent>a:first-child{min-width:10rem;margin-right:2rem}' >> "$OUTPUT/styles.css"
  echo '.namespaceItemContentDoc{margin-top:0.25rem !important;width:100%}' >> "$OUTPUT/styles.css"
  echo '.ddoc .section{display:block;max-width:95%}' >> "$OUTPUT/styles.css"
  echo '.ddoc .namespaceSection{display:block;column-count:4;column-rule:1px solid #fff2;max-width:99%}' >> "$OUTPUT/styles.css"
  echo '.ddoc .namespaceSection .namespaceItem { border-top: 1px dotted #fff2; border-bottom: 1px dotted #000; padding: 0.25rem 0.5rem; margin: 0 !important; }' >> "$OUTPUT/styles.css"
  echo '.ddoc .namespaceSection .namespaceItem:hover { background:#ffffff08; }' >> "$OUTPUT/styles.css"
  echo '.ddoc .namespaceSection .namespaceItem .namespaceItemContent .namespaceItemContentSubItems { width: 100% }' >> "$OUTPUT/styles.css"
  echo '.ddoc .namespaceSection .namespaceItem .docNodeKindIcon {flex-direction: row;order:100}' >> "$OUTPUT/styles.css"
  echo '.ddoc .namespaceSection .namespaceItem .docNodeKindIcon>*+* {margin-top:0}' >> "$OUTPUT/styles.css"
  echo '#topnav { display: none }' >> "$OUTPUT/styles.css"
  echo '#default h2 { display: none }' >> "$OUTPUT/styles.css"
# Run the dev server for the webapp
web:
  node_modules/.bin/vite
# Run the dev server with public access
web-pub:
  node_modules/.bin/vite --host 0.0.0.0
# Run test suite and report coverage.
test:
  ${TEST} -P --no-check --coverage --allow-net test/index.test.ts
  ${COV}
  ${COV} --html
# Run test suite with watcher.
test-watch:
  #!/usr/bin/env -S deno run --coverage --allow-run --allow-env --allow-import --allow-read --allow-write=/tmp/fadroma
  import { entrypoint, runTest } from '../library/Watch.ts';
  export default entrypoint(import.meta, runTest, 'test/index.test.ts');
# Report test coverage.
cov:
  ${COV} --detailed
# Report line counts.
cloc:
  cloc \
    --not-match-d=node_modules \
    --not-match-d=target \
    --not-match-d=dist \
    --not-match-d=deps \
    --not-match-d=.misc \
    --not-match-d=.docs \
    --not-match-d=.deno \
    --not-match-d=coverage \
    .
