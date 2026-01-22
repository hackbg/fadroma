FROM docker.io/library/rust:1.92-trixie
RUN apt update && apt install -yy clang wabt emscripten just time
RUN cargo install wasm-pack wasm-opt bacon
RUN rustup target add wasm32-unknown-unknown
#USER 1000
