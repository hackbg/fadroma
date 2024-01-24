ARG BASE_VER=4.0.3
ARG BASE_SHA=sha256:738f0d04be3a60bd5014706a516bc8c6bbb29c128c4b073eb773544ef382a337
FROM archwaynetwork/archwayd:${BASE_VER}@${BASE_SHA}
RUN apk add nodejs bash curl jq
ENTRYPOINT [ "/usr/bin/node" ]
ADD devnet.init.mjs /
CMD [ "/devnet.init.mjs" ]

