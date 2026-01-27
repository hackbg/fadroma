set export

JUST  := "time just"
BUILD := "time podman build"
RUN   := "time podman run --rm -v .:/app:rw --workdir=/app -it hackbg/fadroma:dev"
CHECK := "time deno check --allow-import"
DOC   := "time deno doc"
TEST  := "time deno test"
COV   := "deno coverage"

# Display available recipes.
list:
  @just --list
# Compile build image in which WASMs are compiled.
wasm-img:
  ${BUILD} -t hackbg/fadroma:dev .
# Open WASM build shell to iterate on WASM modules.
wasm-sh:
  ${RUN}
# Compile dev builds of all WASM modules.
wasm:
  ${JUST} wasm-img
  ${JUST} wasm-simf
  ${JUST} wasm-namada
# Compile dev builds of SimplicityHL module.
wasm-simf:
  ${JUST} wasm-img
  ${RUN} sh -c "cd lib/platform/simf && just wasm"
# Compile dev builds of Namada module.
wasm-namada:
  ${JUST} wasm-img
  ${RUN} sh -c "cd lib/platform/namada && just wasm"
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
  ${CHECK} lib/*.ts
# Generate Deno docs.
doc:
  ${DOC} --html --private --name=@hackbg/fadroma index.ts
# Generate Deno docs with lints.
doc-lint:
  ${DOC} --html --private --lint --name=@hackbg/fadroma index.ts
# Run test suite and report coverage.
test:
  ${TEST} --no-check --coverage \
    --allow-env=FADROMA_SIMF_WASM,FADROMA_SIMF_WRAP,TERM_PROGRAM,COLUMNS,TMPDIR,TMP,TEMP \
    --allow-net \
    --allow-import=deno.land:443,cdn.skypack.dev:443 \
    --allow-read=. \
    --allow-write=/tmp/fadroma \
      lib/index.test.ts
  ${COV}
  ${COV} --html
# Report test coverage.
cov:
  ${COV} --detailed
