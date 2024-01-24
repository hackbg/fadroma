ARG BASE_IMG
ARG BASE_VER
ARG BASE_SHA
FROM ${BASE_IMG}:${BASE_VER}@${BASE_SHA}
RUN apt update && apt install -y nodejs && npm i -g n && n i 20
ENTRYPOINT [ "/usr/bin/node" ]
ADD devnet.init.mjs /
CMD [ "/devnet.init.mjs" ]

