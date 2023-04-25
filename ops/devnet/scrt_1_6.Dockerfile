FROM ghcr.io/scrtlabs/localsecret:v1.6.1
RUN apt update && apt install -y nodejs && npm i -g n && n i 18
ENTRYPOINT [ "/usr/bin/node" ]
ADD devnet.init.mjs /
CMD [ "/devnet.init.mjs" ]
