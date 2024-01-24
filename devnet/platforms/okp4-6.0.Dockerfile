ARG BASE_VER=6.0.0
ARG BASE_SHA=sha256:50f7404014863445d7d83b794ecd91b9a5337e5709a9d1dc19215e519c1acc4a
FROM okp4/okp4d:${BASE_VER}@${BASE_SHA}
RUN apk add nodejs bash curl jq
ENTRYPOINT [ "/usr/bin/node" ]
ADD devnet.init.mjs /
CMD [ "/devnet.init.mjs" ]
