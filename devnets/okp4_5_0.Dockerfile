FROM okp4/okp4d:5.0.0@sha256:b197462e61c068ea094ec9b5693c88c2850606f9eaf53fcbe08a0aa4f6ff90b9
RUN apk add nodejs bash
ENTRYPOINT [ "/usr/bin/node" ]
ADD devnet.init.mjs /
CMD [ "/devnet.init.mjs" ]
