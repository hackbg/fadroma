#!/bin/bash
set -e
echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
echo '|🟢 Fadroma: Secret Network 1.2 Devnet Init'
echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
echo "|API port: $Port"
echo "|Chain ID: $ChainID"
if [ -z "${ChainID}" ]; then
  echo '!!! Set $ChainID'
  exit 1
fi
StateDir="/receipts/$ChainID"
echo "|State in: $StateDir"
mv .secretd "$StateDir/secretd"
mkdir -p "$StateDir/secretcli"
mkdir -p "$StateDir/sgx-secrets"
chmod go+w "$StateDir/secretd"     && ln -s "$StateDir/secretd"     .secretd
chmod go+w "$StateDir/secretcli"   && ln -s "$StateDir/secretcli"   .secretcli
chmod go+w "$StateDir/sgx-secrets" && ln -s "$StateDir/sgx-secrets" .sgx-secrets
mkdir -p ${StateDir}/.{secretd,secretcli,sgx-secrets}
mkdir -p "$StateDir/identities"
echo "|Accounts: $GenesisAccounts"
ConfigFile=~/.secretd/config/genesis.json
echo "|Config:   $ConfigFile"
if [ ! -f "$ConfigFile" ]; then
  echo "|Config file does not exist - preparing genesis"
  rm -rf ~/.secretd/*
  rm -rf /opt/secret/.sgx_secrets/*
  mkdir -p ~/.sgx_secrets
  secretd config chain-id "$ChainID"
  secretd config keyring-backend test
  secretd init fadroma-devnet --chain-id "$ChainID"
  cp ~/node_key.json ~/.secretd/config/node_key.json
  perl -i -pe 's/"stake"/ "uscrt"/g' ~/.secretd/config/genesis.json
  echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  echo "|1. Create and store keys"
  for Name in ${GenesisAccounts[@]}; do
    echo "|$Name..."
    Mnemonic=`secretd keys add "$Name" 2>&1 | tail -n1`
    Address=`secretd keys show -a $Name`
    Identity="$StateDir/identities/$Name.json"
    echo "{\"address\":\"$Address\",\"mnemonic\":\"$Mnemonic\"}" > "$Identity"
    chmod a+rw "$Identity"
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
    secretd gentx "$Name" 1000000uscrt --chain-id "$ChainID" --keyring-backend test
    break
  done
  secretd collect-gentxs
  secretd validate-genesis
  secretd init-bootstrap
  secretd validate-genesis
fi

echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
echo "|Starting lcp..."
lcp --proxyUrl http://localhost:1317 --port $Port --proxyPartial '' &

# sleep infinity

source /opt/sgxsdk/environment \
  && RUST_BACKTRACE=1 secretd start --rpc.laddr tcp://0.0.0.0:26657 --bootstrap
