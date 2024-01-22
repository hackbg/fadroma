FROM ghcr.io/scrtlabs/localsecret:v1.11.0@sha256:75fce4df6739e8d3aca0bcf0d0962d358dbe9463891335fd97700d46c512e277
RUN apt update && apt install -y nodejs && npm i -g n && n i 20
ENTRYPOINT [ "/usr/bin/node" ]
ADD devnet.init.mjs /
CMD [ "/devnet.init.mjs" ]
