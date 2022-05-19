FROM enigmampc/secret-network-sw-dev:v1.2.0
RUN apt update && apt install -y nodejs && npm i -g n && n i 18
ENTRYPOINT [ "/usr/bin/node" ]
ADD devnet-init.mjs devnet-manager.mjs /
CMD [ "/devnet-init.mjs" ]
