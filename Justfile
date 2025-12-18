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
  time docker run -v .:/app:rw --workdir=/app -it hackbg/fadroma:dev sh -c \
    "cd lib/platform/simf && just wasm"
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
  time deno test --coverage --allow-net --allow-read=./namada/pkg/fadroma_namada_bg.wasm
  deno coverage
  deno coverage --html
# Report test coverage.
cov:
  deno coverage --detailed
