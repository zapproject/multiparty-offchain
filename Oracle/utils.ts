import { ZapProvider } from "@zapjs/provider/lib/src";
const eutil = require('ethereumjs-util');
import Config from "./Config.js";

/**
 * Loads a ZapProvider from a given Web3 instance
 * @param web3 - WebSocket Web3 instance to load from
 * @returns ZapProvider instantiated
 */
export async function getProvider(web3): Promise<ZapProvider> {
  // loads the first account for this web3 provider
  const accounts: string[] = await web3.eth.getAccounts();
  if (accounts.length == 0) throw new Error('Unable to find an account in the current web3 provider');
  const owner: string = accounts[0];
  console.log('Loaded account:', owner);
  // TODO: Add Zap balance
  console.log('Wallet contains:', await web3.eth.getBalance(owner) / 1e18, 'ETH');
  return new ZapProvider(owner, {
    networkId: (await web3.eth.net.getId()).toString(),
    networkProvider: web3.currentProvider
  });
}

async function generateAddressesFromSeed(seed: any, count?: number) {
  let bip39 = require("bip39");
  let hdkey = require('ethereumjs-wallet/hdkey');
  let hdwallet = hdkey.fromMasterSeed(await bip39.mnemonicToSeed(seed));
  let wallet_hdpath = "m/44'/60'/0'/0/";

  let accounts = [];
  for (let i = 0; i < 10; i++) {
      let wallet = hdwallet.derivePath(wallet_hdpath + i).getWallet();
      let address = '0x' + wallet.getAddress().toString("hex");
      let privateKey = wallet.getPrivateKey().toString("hex");
      accounts.push({address: address, privateKey: privateKey});
  }

  return accounts;
}

export async function getSignature(answer: any){
  const accounts = await generateAddressesFromSeed(Config.mnemonic);
  const msgHash = eutil.hashPersonalMessage(new Buffer(answer));
  return  JSON.stringify(eutil.ecsign(msgHash, Buffer.from(accounts[0].privateKey, 'hex')));
}