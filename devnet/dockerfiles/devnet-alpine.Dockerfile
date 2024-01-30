ARG BASE
FROM ${BASE}
RUN apk add nodejs bash curl jq
ENTRYPOINT [ "/usr/bin/node" ]
ADD devnet.init.mjs /
CMD [ "/devnet.init.mjs" ]
