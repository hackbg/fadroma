FROM node:18-slim
RUN npm i -g pnpm
RUN mkdir -p /fadroma
WORKDIR /fadroma
ADD . ./
RUN pnpm i
RUN ln -s /fadroma/fadroma.cjs /usr/local/bin/fadroma
RUN fadroma version
