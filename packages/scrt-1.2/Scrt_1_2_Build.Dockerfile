# was "FROM rust:1.46" for 1.0
FROM rust:1.57
ENV PACKAGES binaryen sudo git clang
ENV REGISTRY /usr/local/cargo/registry
ENV USER 1000
ENV GROUP 1000

RUN rustup target add wasm32-unknown-unknown
RUN apt update && apt install -y $PACKAGES && rm -rf /var/lib/apt/lists/*
RUN mkdir -p "$REGISTRY"
WORKDIR /src

# mounted instead:
#ADD ScrtBuild_1_2.sh /entrypoint.sh
#RUN chmod +x /entrypoint.sh
#ENTRYPOINT [ "/entrypoint.sh" ]
