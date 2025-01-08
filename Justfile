check:
  deno check test.ts
test:
  deno test --coverage test.ts
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
