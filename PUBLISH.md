## How to publish

```sh
git clone ...
pnpm -r i
#pnpm -r build #if ts
$EDITOR ...
$EDITOR package.json -> version!
pnpm -r i
#pnpm -r build #if ts
git commit ...
git tag ...
git push
git push --tags
pnpm -r publish --access public
```
