#!/bin/bash

echo $Port

# lookarounds:
#date
#cd ~
#whoami
#pwd
#ls -alh

# config
#ChainID=enigma-pub-testnet-3
Genesis=~/.secretd/config/genesis.json
GenesisKeys=/shared-keys
#GenesisAccounts=(ADMIN ALICE BOB CHARLIE DAVE EUSTACE MALLORY)

# run genesis once
if [ ! -e "$Genesis" ]; then

  echo "prepare for genesis ==================="
  echo "clear state ---------------------------"
  rm -rf ~/.secretd/* ~/.secretcli/* ~/.sgx_secrets/*
  echo "initialize secretcli-------------------"
  secretcli config chain-id $ChainID
  secretcli config output json
  secretcli config indent true
  secretcli config trust-node true
  secretcli config keyring-backend test
  echo "initialize secretd---------------------"
  secretd init banana --chain-id $ChainID
  cp ~/node_key.json ~/.secretd/config/node_key.json
  perl -i -pe 's/"stake"/"uscrt"/g' ~/.secretd/config/genesis.json # wtf is going on here

  echo "prepare genesis accounts =============="
  for Name in ${GenesisAccounts[@]}; do
    echo "[$Name] 1. create key"
    Key=`secretcli keys add $Name 2>&1`
    echo "[$Name] 2. store key"
    echo "$Key" > /shared-keys/$Name.json
    cat /shared-keys/$Name.json
    chmod a+rw /shared-keys/$Name.json
    echo "[$Name] 3. get address"
    Address="$(secretcli keys show -a $Name)"
    echo "$Address"
    echo "[$Name] 4. add to genesis"
    secretd add-genesis-account "$Address" 1000000000000000000uscrt
    secretd gentx --name $Name --keyring-backend test --amount 1000000uscrt
  done

  echo "perform genesis ======================="
  echo "stage 1--------------------------------"
  secretd collect-gentxs
  secretd validate-genesis
  echo "stage 2--------------------------------"
  secretd init-bootstrap
  secretd validate-genesis
  echo "GENESIS COMPLETE ======================"
fi

secretcli rest-server --trust-node=true --chain-id enigma-pub-testnet-3 --laddr tcp://0.0.0.0:1336 &
lcp --proxyUrl http://localhost:1336 --port $Port --proxyPartial '' &

# sleep infinity
source /opt/sgxsdk/environment && \
  RUST_BACKTRACE=1 secretd start --rpc.laddr tcp://0.0.0.0:26657 --bootstrap

