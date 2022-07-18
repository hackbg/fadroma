FROM ghcr.io/scrtlabs/localsecret:v1.3.0
RUN apt update && apt install -y nodejs && npm i -g n && n i 18
ENTRYPOINT [ "/usr/bin/node" ]
ADD devnet-init.mjs devnet-manager.mjs /
CMD [ "/devnet-init.mjs" ]
