wasm:
  CC=emcc cargo build --target wasm32-unknown-emscripten
wasm-dev:
  CC=emcc cargo build --target wasm32-unknown-emscripten --release
wasm-pack:
  CC=emcc RUSTFLAGS=-Cpanic=abort wasm-pack build --release --target web -- --target wasm32-unknown-emscripten
  rm -v pkg/package.json pkg/.gitignore
wasm-pack-dev:
  CC=emcc RUSTFLAGS=-Cpanic=abort wasm-pack build --target web -- --target wasm32-unknown-emscripten
  rm -v pkg/package.json pkg/.gitignore
