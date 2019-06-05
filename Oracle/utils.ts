import { ZapProvider } from "@zapjs/provider/lib/src";
const eutil = require('ethereumjs-util');
import Config from "./Config.js";

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
  const msgHash = eutil.hashPersonalMessage(new Buffer(answer.toString()));
  return  eutil.ecsign(msgHash, Buffer.from(accounts[0].privateKey, 'hex'));
}