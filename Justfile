set export
BUILDER  := "docker" # podman, buildah...
IMAGE    := "hackbg/fadroma:dev"
JUST     := "time just"
RUN      := "time podman run --rm -v .:/app:rw --workdir=/app -it hackbg/fadroma:dev"
CHECK    := "time deno check --allow-import"
DOC      := "time deno doc"
TEST     := "time deno test"
TEST_ENV := "FADROMA_SIMF_WASM,FADROMA_SIMF_WRAP,TERM_PROGRAM,COLUMNS,TMPDIR,TMP,TEMP,NODE_V8_COVERAGE"
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
# Generate Deno docs.
doc:
  ${DOC} --html --private --name=@hackbg/fadroma index.ts
# Generate Deno docs with lints.
doc-lint:
  ${DOC} --html --private --lint --name=@hackbg/fadroma index.ts
# Run test suite and report coverage.
test:
  ${TEST} --no-check --coverage \
    --allow-env=${TEST_ENV} \
    --allow-net \
    --allow-import=deno.land:443,cdn.skypack.dev:443 \
    --allow-run=elementsd \
    --allow-read=. \
    --allow-write=/tmp/fadroma \
      test/index.test.ts
  ${COV}
  ${COV} --html
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
