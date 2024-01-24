ARG BASE_VER=22.0.1-alpine
ARG BASE_SHA=sha256:71511ed82fecfc6b9d72ea5a2f07ca4373e4222e1ffaa96c891013306af9e570
FROM osmolabs/osmosis:${BASE_VER}@${BASE_SHA}
RUN apk add nodejs bash curl jq
ENTRYPOINT [ "/usr/bin/node" ]
ADD devnet.init.mjs /
CMD [ "/devnet.init.mjs" ]
