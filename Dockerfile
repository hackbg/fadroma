FROM rust:1.61-slim
RUN apt update && apt install -y nodejs npm curl wget binaryen git clang && ls -al /var/cache/apt/archives && apt-get clean
RUN npm i -g n && n i 18
RUN npm i -g pnpm@^7.5 && pnpm --version
RUN rustup default 1.59 && rustup target add wasm32-unknown-unknown && rustup toolchain list && rustup target list
#RUN rustup component add llvm-tools-preview && cargo install grcov
ENV LLVM_PROFILE_FILE="%p-%m.profraw"

##Old:
#FROM node:18-slim
## >=7.1.1 needed to avoid hanging on gh deps
#RUN npm i -g 'pnpm@^7.1.1'
## add source
#RUN mkdir -p /fadroma
#WORKDIR /fadroma
#ADD . ./
## set dependency cache
#RUN mkdir -p /pnpm-store && pnpm c -g set store-dir=/pnpm-store
## install dependencies
#RUN pnpm i
## make cli globally available
#RUN ln -s /fadroma/fadroma.cjs /usr/local/bin/fadroma
## smoke test
#RUN fadroma version
## add git
#RUN apt update && apt install -y git && apt clean
## prevent bip32 from breaking
#ENV NODE_OPTIONS=--openssl-legacy-provider
