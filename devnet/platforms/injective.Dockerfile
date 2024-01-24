ARG BASE_VER=v1.12.9-testnet
ARG BASE_SHA=sha256:6af75fe970423dfa5b3df9a2023181dba95a86bc3d718eb7abab09d8ed8ff417
FROM public.ecr.aws/l9h3g6c6/injective-core:${BASE_VER}@${BASE_SHA}
RUN apt update && apt install -y nodejs npm && npm i -g n && n i 20
ENTRYPOINT [ "/usr/bin/node" ]
ADD devnet.init.mjs /
CMD [ "/devnet.init.mjs" ]
