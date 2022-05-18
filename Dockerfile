FROM node:18-slim
RUN npm i -g pnpm
RUN mkdir -p /fadroma /pnpm-store
WORKDIR /fadroma
ADD . ./
RUN pnpm c -g set store-dir=/pnpm-store
RUN pnpm i
RUN ln -s /fadroma/fadroma.cjs /usr/local/bin/fadroma
RUN fadroma version
