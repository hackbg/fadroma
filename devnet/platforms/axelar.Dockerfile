ARG BASE_VER=0.34.3
ARG BASE_SHA=sha256:6e99f8913054bbd81b8fe248c8c6ade736bc751f822ae6f9556cc0b8fe3a998d
FROM axelarnetwork/axelar-core:v${BASE_VER}@${BASE_SHA}
RUN apk add nodejs bash curl jq
ENTRYPOINT [ "/usr/bin/node" ]
ADD devnet.init.mjs /
CMD [ "/devnet.init.mjs" ]
