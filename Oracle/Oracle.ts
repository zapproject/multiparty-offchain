import Config from "./Config.js";
const Web3 = require('web3');
//import { ZapToken } from "@zapjs/zaptoken";
import { ZapDispatch } from "@zapjs/dispatch";
const HDWalletProviderMem = require("truffle-hdwallet-provider");
const {utf8ToHex, toBN, hexToUtf8, bytesToHex, hexToBytes, toHex, fromWei} = require("web3-utils");
const assert = require("assert")
const IPFS = require("ipfs-mini")
const ipfs = new IPFS({host:'ipfs.infura.io',port:5001,protocol:'https'})
const IPFS_GATEWAY = "https://gateway.ipfs.io/ipfs/"
import {connectStatus} from "./Status";
import { addQuery, addResponseToDb, handleResponsesInDb } from "../db/queries";
import { handleRemoteResponses } from '../endpoints';
const cron = require('node-cron');
import { ResponseEvent } from "./types";
import { config } from "bluebird";
import { exists } from "fs";
const DEFAULT_GAS = 200000;
const MPO = require('../contracts/MultiPartyOracle.json');
const MPOStorage = require('../contracts/MPOStorage.json');
const Registry = require('../contracts/Registry.json');
const Subscriber = require("../contracts/TestClient.json");
const Coordinator = require("../contracts/ZapCoordinator.json");
const Provider = require("../contracts/TestProvider.json");
const Dispatch = require("../contracts/Dispatch.json");
const ZapToken = require("../contracts/ZapToken.json");
const Bondage = require("../contracts/Bondage.json");

export  class ZapOracle {
    private web3: any;
    private aggregator: any;
    private zapToken: any
    private respondersQuantity: number;
    private responders: Array<string>; 
    private blockNumber: number;
    contract: {
        MPO: any;
        MPOStorage: any;
        Dispatch: any;
        ZapToken: any;
        ZapBondage: any;
    }

    constructor(){
        this.web3 = new Web3(new HDWalletProviderMem(Config.mnemonic, Config.NODE_URL))
        this.aggregator = null
        this.zapToken = null
        this.sendToBlockchain = this.sendToBlockchain.bind(this);
        this.blockNumber = 0;//to get from persistent
    }
    validateConfig() {
        assert(Config.mnemonic, "mnemonic is required to run Oracle")
        assert(Config.title, "title is required to run Oracle")
        assert(Config.public_key, "public_key is required to run Oracle")
    }

    async initialize() {
        const _Coordinator = new this.web3.eth.Contract(Coordinator.abi, '0x0014f9acd4f4ad4ac65fec3dcee75736fd0a0230');
        console.log(await _Coordinator.methods.getContract("DISPATCH").call());
        console.log(await _Coordinator.methods.getContract("ZAP_TOKEN").call());
        console.log(await _Coordinator.methods.getContract("BONDAGE").call());
       this.contract = {
            MPO: new this.web3.eth.Contract(MPO.abi, Config.contractAddress),
            MPOStorage: new this.web3.eth.Contract(MPOStorage.abi, '0xb116b3f8dfa62b3d1c279abf66df6b4bc85a1108'),
            Dispatch: new this.web3.eth.Contract(Dispatch.abi, '0x6b6AFD3FC0a7f47d48f9C5Fc13375a40E70BbBD3'),
            ZapToken: new this.web3.eth.Contract(ZapToken.abi, '0x977BfB630b4D4d95ac7B288F1b54A07456CB6fb6'),
            ZapBondage: new this.web3.eth.Contract(Bondage.abi, '0xfFDff0C05d5566c50307dCBDc63b45E2e24A095D')
        }
        this.responders = (await this.contract.MPOStorage.methods.getResponders().call()).map(res => res.toUpperCase());
        console.log(this.responders);
        if(!this.responders) {
            this.responders = await this.contract.MPO.methods.setup(Config.EndpointSchema.responders).send({from: Config.public_key});
            if (this.responders.length) {
                console.log("list of responders is required to run Oracle");
                process.exit(1);
            }
        }
        this.contract.MPO.events.allEvents(
            {},
            { fromBlock: 0, toBlock: 'latest' },
            (err, res) => {
                this.blockNumber = res.blockNumber;//to-do save
                this.handleQuery(res);
            }
        );
        const accounts: string[] = await this.web3.eth.getAccounts();
        this.aggregator = accounts[0];
        console.log(await this.contract.ZapToken.methods.balanceOf(accounts[0]).call(), await this.web3.eth.getBalance(accounts[0]));
        console.log("al", await this.contract.ZapToken.methods.allowance(accounts[0], '0xfFDff0C05d5566c50307dCBDc63b45E2e24A095D').call());
        
        
        //const params = [utf8ToHex("ETH"), utf8ToHex("BTC"), "0x"+"0".repeat(64-"3".length)+"3"];
        //this.contract.Dispatch.methods.query(Config.contractAddress, 'halo', utf8ToHex("Nonproviders"), params).send({from: accounts[0], gas: 1400000})


        console.log("Start listening to responses and saving to db");
        handleRemoteResponses((err) => console.log(err), this.responders, addResponseToDb);

        console.log("Everty minute check for nessesary number of responses to each query and for timed out queries and then send responses to subscribers");
        cron.schedule('* * * * *', () => handleResponsesInDb(this.responders.length, this.responders, this.sendToBlockchain));

    }
    
    delay = (ms:number) => new Promise(_ => setTimeout(_, ms));

    async handleQuery(queryEvent: any): Promise<void> {
        console.log(queryEvent)
        const results: any = queryEvent.returnValues;
        let response: string[] | number[]
        // Parse the event into a usable JS object
        const event: any = {
            queryId: results.id,
            query: results.query,
            endpoint: (results.endpoint),//hexToUtf8(results.endpoint),
            subscriber: results.subscriber,
            endpointParams: results.endpointParams,//.map(hexToUtf8),
            onchainSub: results.onchainSubscriber
        }
        //console.log(`Received query to ${event.endpoint} from ${event.onchainSub ? 'contract' : 'offchain subscriber'} at address ${event.subscriber}`);
        //console.log(`Query ID ${event.queryId.substring(0, 8)}...: "${event.query}". Parameters: ${event.endpointParams}`);
        await addQuery(event);   
    }

    async sendToBlockchain(responses: Object) {
        console.log('respy', responses);
       const promises = [];
       const responded = [];
        for(const queryId of Object.keys(responses)) {
            const { hash, sigv, response, sigrs } = responses[queryId];
            await this.contract.MPO.methods.callback(
                new String(queryId).valueOf(),
                response,
                hash,
                sigv,
                sigrs
                ).send({from: this.aggregator, gas: DEFAULT_GAS, gasPrice: 20000000000})
                .on('error', function(error){ return {error, responded} });
            responded.push(queryId);
        };
        return true;
    }
  }