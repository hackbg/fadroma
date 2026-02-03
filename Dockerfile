FROM docker.io/library/rust:1.92-trixie AS wasm-builder
RUN rustup target add wasm32-unknown-unknown
RUN apt update && apt install -yy clang wabt emscripten just time curl
ARG BINARYEN="https://github.com/WebAssembly/binaryen/releases/download/version_125/binaryen-version_125-x86_64-linux.tar.gz"
RUN cd /usr/local && curl -Lf "${BINARYEN}" | tar --strip-components=1 -xz
RUN cargo install wasm-pack bacon
#USER 1000
