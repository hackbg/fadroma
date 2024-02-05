ARG BASE
FROM ${BASE}
RUN apt update && apt install -y nodejs && npm i -g n && n i 20 && rm -rf /var/lib/apt/lists/*
ENTRYPOINT [ "/usr/bin/node" ]
ADD devnet.init.mjs /
CMD [ "/devnet.init.mjs" ]
