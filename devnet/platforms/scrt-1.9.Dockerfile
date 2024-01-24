ARG BASE_VER=
ARG BASE_SHA=
FROM ghcr.io/scrtlabs/localsecret:v1.9.3@sha256:3da3483719797163c138790e2acb85dd0b3c64e512ce134336ab96ccb5699577 
RUN apt update && apt install -y nodejs && npm i -g n && n i 20
ENTRYPOINT [ "/usr/bin/node" ]
ADD devnet.init.mjs /
CMD [ "/devnet.init.mjs" ]
