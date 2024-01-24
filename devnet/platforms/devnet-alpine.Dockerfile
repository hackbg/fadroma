ARG BASE_IMG
ARG BASE_VER
ARG BASE_SHA
FROM ${BASE_IMG}:${BASE_VER}@${BASE_SHA}
RUN apk add nodejs bash curl jq
ENTRYPOINT [ "/usr/bin/node" ]
ADD devnet.init.mjs /
CMD [ "/devnet.init.mjs" ]
