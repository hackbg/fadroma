FROM ghcr.io/scrtlabs/localsecret:v1.12.1@sha256:5f0e1bfe10066deb6c86e1965c9b09b13cecc36a007ca50eb87630eebd2b294c
RUN apt update && apt install -y nodejs && npm i -g n && n i 20
ENTRYPOINT [ "/usr/bin/node" ]
ADD devnet.init.mjs /
CMD [ "/devnet.init.mjs" ]
