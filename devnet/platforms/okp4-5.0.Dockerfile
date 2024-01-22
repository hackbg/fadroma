FROM registry.hub.docker.com/okp4/okp4d:5.0.0@sha256:b197462e61c068ea094ec9b5693c88c2850606f9eaf53fcbe08a0aa4f6ff90b9
RUN apk add nodejs bash curl jq
ENTRYPOINT [ "/usr/bin/node" ]
ADD devnet.init.mjs /
CMD [ "/devnet.init.mjs" ]

# {"jsonrpc":"2.0","id":595486116712,"method":"abci_query","params":{"path":"/cosmwasm.wasm.v1.Query/Codes","data":"","prove":false}}
# {"jsonrpc":"2.0","id":655138293622,"method":"abci_query","params":{"path":"/cosmwasm.wasm.v1.Query/Code","data":"0811","varprove":false}}

#curl --header 'Content-Type: application/json' --request POST --data '{"jsonrpc":"2.0","id":"fadroma","method":"abci_query","params":{"path":"/cosmwasm.wasm.v1.Query/Codes","data":"","prove":false}}' https://okp4-testnet-rpc.polkachu.com | jq -r .result.response.value | base64 -d | protoc --decode_raw
