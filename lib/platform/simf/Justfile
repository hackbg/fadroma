wasm:
  CC=emcc EMCC_CFLAGS=--no-entry cargo build --target wasm32-unknown-emscripten
wasm-dev:
  CC=emcc EMCC_CFLAGS=--no-entry cargo build --target wasm32-unknown-emscripten --release
wasm-pack-unknown:
  RUSTFLAGS=-Cpanic=abort time wasm-pack build --release --target web
  rm -v pkg/package.json pkg/.gitignore
wasm-pack-unknown-dev:
  RUSTFLAGS=-Cpanic=abort time wasm-pack build --debug --target web
  rm -v pkg/package.json pkg/.gitignore
wasm-pack-emscripten:
  CC=emcc RUSTFLAGS=-Cpanic=abort time wasm-pack build --release --target web -- --target wasm32-unknown-emscripten
  rm -v pkg/package.json pkg/.gitignore
wasm-pack-emscripten-dev:
  CC=emcc RUSTFLAGS=-Cpanic=abort time wasm-pack build --debug --target web -- --target wasm32-unknown-emscripten
  rm -v pkg/package.json pkg/.gitignore
