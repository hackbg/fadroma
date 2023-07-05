FROM registry.hub.docker.com/library/rust:1.69-slim@sha256:2522978d04d670d70389ee2d91ae7d266f622eb619560f6a242ee4c5544a39c5

# Install Rust
RUN rustup default 1.69 && \
  rustup target add wasm32-unknown-unknown && \
  rustup toolchain list && \
  rustup target list
#RUN rustup toolchain install nightly && \
  #rustup target add --toolchain nightly wasm32-unknown-unknown && \
  #rustup toolchain list && \
  #rustup target list
#RUN rustup component add llvm-tools-preview && cargo install grcov

# Install Node and PNPM
RUN apt update && \
  apt install -y nodejs npm binaryen git curl wget clang cmake wabt jq tree && \
  ls -al /var/cache/apt/archives && \
  apt-get clean
RUN npm i -g n && n i 20
RUN corepack enable

# Install Docker CLI
ENV DOCKERVERSION=20.10.23
RUN curl -fsSLO https://download.docker.com/linux/static/stable/x86_64/docker-${DOCKERVERSION}.tgz \
  && tar xzvf docker-${DOCKERVERSION}.tgz --strip 1 \
                 -C /usr/local/bin docker/docker \
  && rm docker-${DOCKERVERSION}.tgz

ENV LLVM_PROFILE_FILE="%p-%m.profraw"

RUN git config --global --add safe.directory "*"
RUN git config --global http.postBuffer 524288000
RUN git config --global http.lowSpeedTime 600
