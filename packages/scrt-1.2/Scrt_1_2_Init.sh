#!/bin/bash

set -e

echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
echo '|🟢 Fadroma 23.0.0 "Welcome To The Party"'
echo '|Secret Network 1.2 Localnet Init'
echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
echo "|API on port $Port"
file=~/.secretd/config/genesis.json
echo "|Config from $file"

if [ ! -e "$file" ]
then
  echo "|Which exists"

  # init the node
  rm -rf ~/.secretd/*
  rm -rf /opt/secret/.sgx_secrets/*

  echo "|Chain ID: $CHAINID"
  if [ -z "${CHAINID}" ]; then
    echo '!!! Set $CHAINID'
    exit 1
  else
    chain_id="$CHAINID"
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
  echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  echo "|Fadroma will now prepare the genesis accounts"

  echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  echo "|1. Create and store keys"
  for Name in ${GenesisAccounts[@]}; do
    echo "|$Name..."
    Mnemonic=`secretd keys add "$Name" 2>&1 | tail -n1`
    Address=`secretd keys show -a $Name`
    echo "{\"address\":\"$Address\",\"mnemonic\":\"$Mnemonic\"}" > /shared-keys/$Name.json
    chmod a+rw /shared-keys/$Name.json
  done

  echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  echo "|2. Add genesis accounts"
  Amount="1000000000000000000uscrt"
  for Name in ${GenesisAccounts[@]}; do
    echo "|$Amount to $Name..."
    Address=`secretd keys show -a $Name`
    secretd add-genesis-account "$Address" "$Amount"
  done

  echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  echo "|3. Add genesis transactions"
  for Name in ${GenesisAccounts[@]}; do
    echo "|$Name..."
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

echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
echo "|Starting lcp..."
lcp --proxyUrl http://localhost:1317 --port $Port --proxyPartial '' &

# sleep infinity
source /opt/sgxsdk/environment && RUST_BACKTRACE=1 secretd start --rpc.laddr tcp://0.0.0.0:26657 --bootstrap
