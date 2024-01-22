FROM ghcr.io/scrtlabs/localsecret:v1.10.0@sha256:3c7bbf2c0c3ec9808c235d3e8157819ec6f8803e428cb8b60ff902c59ef06e52
RUN apt update && apt install -y nodejs && npm i -g n && n i 20
ENTRYPOINT [ "/usr/bin/node" ]
ADD devnet.init.mjs /
CMD [ "/devnet.init.mjs" ]
