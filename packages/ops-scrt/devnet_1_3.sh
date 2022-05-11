#!/bin/bash
set -e

look () { pwd && ls -al; }

if [ -z "${ChainID}" ]; then echo '!!! Set $ChainID'; exit 1; fi
State="/receipts/$ChainID"
ConfigFile=~/.secretd/config/genesis.json

echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
echo '|🟢 Fadroma: Secret Network 1.3 Devnet Init'
echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
echo "|API port: $Port"
echo "|Chain ID: $ChainID"
echo "|State:    $State"
echo "|Accounts: $GenesisAccounts"
echo "|Config:   $ConfigFile"

fix_permissions () {
  echo "Relaxing permissions on $State..."
  if [ -d "$State" ]; then chmod -R a+rwx $State; fi
}

trap fix_permissions 1 2 3 6 9

genesis_1 () {
  echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  echo "|1. Setup state directories"
  rm -rf ~/.secretd ~/.secretcli /opt/secret/.sgx-secrets
  umask
  umask 0000
  mkdir -p $State $State/identities
  umask 0022
  fix_permissions
  secretd config chain-id "$ChainID"
  secretd config keyring-backend test
  secretd init fadroma-devnet --chain-id "$ChainID"
  cp ~/node_key.json ~/.secretd/config/node_key.json
  perl -i -pe 's/"stake"/ "uscrt"/g' ~/.secretd/config/genesis.json
}

genesis_2 () {
  echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  echo "|2. Create and store keys"
  for Name in ${GenesisAccounts[@]}; do
    echo "|$Name..."
    Mnemonic=`secretd keys add "$Name" 2>&1 | tail -n1`
    Address=`secretd keys show -a $Name`
    Identity="$State/identities/$Name.json"
    echo "{\"address\":\"$Address\",\"mnemonic\":\"$Mnemonic\"}" > "$Identity"
    chmod a+rw "$Identity"
  done
}

genesis_3 () {
  echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  echo "|3. Add genesis accounts"
  Amount="1000000000000000000uscrt"
  for Name in ${GenesisAccounts[@]}; do
    echo "|$Amount to $Name..."
    Address=`secretd keys show -a $Name`
    secretd add-genesis-account "$Address" "$Amount"
  done
}

genesis_4 () {
  echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  echo "|4. Add genesis transactions"
  for Name in ${GenesisAccounts[@]}; do
    echo "|$Name..."
    secretd gentx "$Name" 1000000uscrt --chain-id "$ChainID" --keyring-backend test
    break
  done
}

genesis_5 () {
  echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  echo "|5. Perform genesis"
  echo "|secretd collect-gentxs"
  secretd collect-gentxs
  echo "|secretd validate-gentxs"
  secretd validate-genesis
  echo "|secretd init-bootstrap"
  secretd init-bootstrap
  echo "|secretd validate-genesis"
  secretd validate-genesis
}

fix_permissions
if [ ! -f "$ConfigFile" ]; then
  echo "|Config file does not exist - performing genesis"
  genesis_1
  genesis_2
  genesis_3
  genesis_4
  genesis_5
  fix_permissions
  echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
  echo "|Genesis complete."
fi

echo "~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~"
echo "|Starting lcp..."
lcp --proxyUrl http://localhost:1317 --port 1316 --proxyPartial '' &
fix_permissions

source /opt/sgxsdk/environment
RUST_BACKTRACE=1 secretd start --rpc.laddr tcp://0.0.0.0:26577 --bootstrap
