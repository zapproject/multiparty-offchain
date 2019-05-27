/**
  Call zap server to let it knows oracle is still online
*/

const Web3 = require('web3');
import {toHex,utf8ToHex} from "web3-utils"
import {ZapProvider} from "@zapjs/provider"
import {ZapBondage} from "@zapjs/bondage"
const HDWalletProviderMem = require("truffle-hdwallet-provider");
const io =require("socket.io-client");
import Config from "./Config.js";
const rq = require("request-promise");
const ZAP_SERVER = "http://localhost:8000";
const eutil = require('ethereumjs-util');

export const connectStatus= async (web3:any,endpoint:any)=>{
  let accounts = await web3.eth.getAccounts()
  let oracle = accounts[0]
  console.log(oracle)
  let socket = io(Config.STATUS_URL,{path:"/ws/",secure:true})
  socket.on("connect",async ()=>{
    const signature = await web3.eth.sign(endpoint,oracle)
    console.log(signature)
    socket.emit("authentication",{endpoint:"TrendSignals",signature})
  })
  socket.on("authenticated",()=>{
    console.log("authenticated")
  })
  socket.on("unauthorized",()=>{
    console.log("unauthorized")
  })
}