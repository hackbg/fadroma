FROM ghcr.io/scrtlabs/localsecret:v1.7.1@sha256:3c3fe7a3083e564597cc8681939a248b3ba3ce3104d69c2f94682f0e3d17f3ca
RUN apt update && apt install -y nodejs && npm i -g n && n i 18
ENTRYPOINT [ "/usr/bin/node" ]
ADD devnet.init.mjs /
CMD [ "/devnet.init.mjs" ]
