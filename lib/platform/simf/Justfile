wasm:
  CC=emcc EMCC_CFLAGS=--no-entry cargo build --target wasm32-unknown-emscripten
wasm-dev:
  CC=emcc EMCC_CFLAGS=--no-entry cargo build --target wasm32-unknown-emscripten --release
wasm-pack-unknown:
  time wasm-pack build --release --target web
  rm -v pkg/package.json pkg/.gitignore
wasm-pack-unknown-dev:
  time wasm-pack build --debug --no-opt --target web
  rm -v pkg/package.json pkg/.gitignore
wasm-pack-emscripten:
  CC=emcc time wasm-pack build --release --target web -- --target wasm32-unknown-emscripten
  rm -v pkg/package.json pkg/.gitignore
wasm-pack-emscripten-dev:
  CC=emcc time wasm-pack build --debug --target web -- --target wasm32-unknown-emscripten
  rm -v pkg/package.json pkg/.gitignore
