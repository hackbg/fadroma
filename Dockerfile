FROM docker.io/library/rust:1.92-trixie
RUN apt update && apt install -yy clang wabt emscripten just time
ADD --unpack https://github.com/WebAssembly/binaryen/releases/download/version_125/binaryen-version_125-x86_64-linux.tar.gz /usr/local/
RUN cargo install wasm-pack bacon
RUN rustup target add wasm32-unknown-unknown
#USER 1000
