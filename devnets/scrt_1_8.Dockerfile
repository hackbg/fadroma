FROM ghcr.io/scrtlabs/localsecret:v1.8.0@sha256:df31b5b20131431b00fd166de5f57fc07d5411ab586c665490ad875316c89afa
RUN apt update && apt install -y nodejs && npm i -g n && n i 20
ENTRYPOINT [ "/usr/bin/node" ]
ADD devnet.init.mjs /
CMD [ "/devnet.init.mjs" ]
