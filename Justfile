test:
  deno test --coverage --allow-read=./namada/pkg/fadroma_namada_bg.wasm
  deno coverage
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
  for mod in {core/lib,tm/lib,namada/lib}; do echo $mod; cloc $mod; done
