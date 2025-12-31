# Display available recipes.
list:
  @just --list
# Compile build image in which WASMs are compiled.
wasm-img:
  time docker build -t hackbg/fadroma:dev .
# Open WASM build shell to iterate on WASM modules.
wasm-sh:
  docker run -v .:/app:rw --workdir=/app -it hackbg/fadroma:dev
# Compile dev builds of all WASM modules.
wasm:
  time just wasm-img
  time just wasm-simf
  time just wasm-namada
# Compile dev builds of SimplicityHL module.
wasm-simf:
  time just wasm-img
  time docker run -v .:/app:rw --workdir=/app -it hackbg/fadroma:dev sh -c \
    "cd lib/platform/simf && just wasm"
# Compile dev builds of Namada module.
wasm-namada:
  time just wasm-img
  time docker run -v .:/app:rw --workdir=/app -it hackbg/fadroma:dev sh -c \
    "cd lib/platform/namada && just wasm"
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
# Typecheck.
check:
  deno check --allow-import lib/index.test.ts
# Generate Deno docs.
doc:
  deno doc --html --private --name=@hackbg/fadroma index.ts
# Generate Deno docs with lints.
doc-lint:
  deno doc --html --private --lint --name=@hackbg/fadroma index.ts
# Run test suite and report coverage.
test:
  time deno test --no-check --coverage \
    --allow-env=FADROMA_SIMF_WASM,FADROMA_SIMF_WRAP,TERM_PROGRAM,COLUMNS,TMPDIR,TMP,TEMP \
    --allow-net \
    --allow-import=deno.land:443,cdn.skypack.dev:443 \
    --allow-read=. \
    --allow-write=/tmp/fadroma \
      lib/index.test.ts
  deno coverage
  deno coverage --html
# Report test coverage.
cov:
  deno coverage --detailed
