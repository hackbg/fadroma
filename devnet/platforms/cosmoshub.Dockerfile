ARG BASE_VER=14.1.0
ARG BASE_SHA=sha256:deab1dd347bdfc379bb7e00525be8a869a917ecf2ca10147ae6077bf15a0fcd5
FROM shapeshiftdao/cosmoshub:v${BASE_VER}@${BASE_SHA}
RUN apk add nodejs bash curl jq
ENTRYPOINT [ "/usr/bin/node" ]
ADD devnet.init.mjs /
CMD [ "/devnet.init.mjs" ]
