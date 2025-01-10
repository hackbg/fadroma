test:
  time deno test --coverage --allow-net --allow-read=./namada/pkg/fadroma_namada_bg.wasm
  deno coverage
  deno coverage --html
cov:
  deno coverage --detailed
check:
  deno check test.ts
push:
  git push
tpush:
  git push --tags
fpush:
  git push --force
ftpush:
  git push --tags --force
cloc:
  cloc --not-match-d=node_modules --not-match-d=.deno --not-match-d=coverage .
