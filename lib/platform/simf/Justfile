# List tasks
list:
  @just --list
# Build in dev mode (with stack trace)
wasm:
  time wasm-pack build --debug --no-opt --target web
  rm -v pkg/package.json pkg/.gitignore
  @just inspect
# Build in release mode (with optimizations)
wasm-release:
  time wasm-pack build --release --target web
  rm -v pkg/package.json pkg/.gitignore
  @just inspect
# Show imports and exports of built module
inspect:
  wasm2wat pkg/fadroma_simf_bg.wasm | grep import
  wasm2wat pkg/fadroma_simf_bg.wasm | grep export
# Run tests for this platform
test:
  ../simf.test.ts
