#!/bin/bash

set -e

echo "API on port $Port"

file=~/.secretd/config/genesis.json
if [ ! -e "$file" ]
then
  # init the node
  rm -rf ~/.secretd/*
  rm -rf /opt/secret/.sgx_secrets/*

  if [ -z "${CHAINID}" ]; then
    chain_id="$CHAINID"
  else
    chain_id="supernova-1"
  fi

  mkdir -p ./.sgx_secrets
  secretd config chain-id "$chain_id"
  secretd config keyring-backend test

  # export SECRET_NETWORK_CHAIN_ID=secretdev-1
  # export SECRET_NETWORK_KEYRING_BACKEND=test
  secretd init banana --chain-id "$chain_id"

  cp ~/node_key.json ~/.secretd/config/node_key.json
  perl -i -pe 's/"stake"/ "uscrt"/g' ~/.secretd/config/genesis.json


  echo
  echo "FADROMA: prepare genesis accounts"

  echo "1. Create and store keys"
  for Name in ${GenesisAccounts[@]}; do
    echo "$Name..."
    Mnemonic=`secretd keys add "$Name" 2>&1 | tail -n1`
    Address=`secretd keys show -a $Name`
    echo "{\"address\":\"$Address\",\"mnemonic\":\"$Mnemonic\"}" > /shared-keys/$Name.json
    chmod a+rw /shared-keys/$Name.json
  done

  echo "2. Add genesis accounts"
  Amount="1000000000000000000uscrt"
  for Name in ${GenesisAccounts[@]}; do
    echo "$Amount to $Name..."
    Address=`secretd keys show -a $Name`
    secretd add-genesis-account "$Address" "$Amount"
  done

  echo "3. Add genesis transactions"
  for Name in ${GenesisAccounts[@]}; do
    echo "$Name..."
    secretd gentx "$Name" 1000000uscrt --chain-id "$chain_id" --keyring-backend test
    break
  done

  secretd collect-gentxs
  secretd validate-genesis

#  secretd init-enclave
  secretd init-bootstrap
#  cp new_node_seed_exchange_keypair.sealed .sgx_secrets
  secretd validate-genesis
fi

lcp --proxyUrl http://localhost:1317 --port $Port --proxyPartial '' &

# sleep infinity
source /opt/sgxsdk/environment && RUST_BACKTRACE=1 secretd start --rpc.laddr tcp://0.0.0.0:26657 --bootstrap
