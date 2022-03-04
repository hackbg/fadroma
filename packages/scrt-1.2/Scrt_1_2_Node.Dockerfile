FROM enigmampc/secret-network-sw-dev:v1.2.0
RUN apt update
RUN apt install -y nodejs
ENTRYPOINT [ "/usr/bin/node" ]
ADD Scrt_1_2_Node.js Scrt_1_2_Node.sh /
CMD [ "/Scrt_1_2_Node.js" ]
