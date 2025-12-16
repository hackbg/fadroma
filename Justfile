list:
  @just --list

# Compile dev builds of all WASM modules
wasm:
  cd lib/platform/btc && just wasm
  cd lib/platform/simf && just wasm
  cd lib/platform/namada && just wasm

# Report line counts
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

check:
  deno check --allow-import test.ts
doc:
  deno doc --html --private --name=@hackbg/fadroma index.ts
doc-lint:
  deno doc --html --private --lint --name=@hackbg/fadroma index.ts
test:
  time deno test --coverage --allow-net --allow-read=./namada/pkg/fadroma_namada_bg.wasm
  deno coverage
  deno coverage --html
cov:
  deno coverage --detailed

push:
  git push
tpush:
  git push --tags
fpush:
  git push --force
ftpush:
  git push --tags --force
