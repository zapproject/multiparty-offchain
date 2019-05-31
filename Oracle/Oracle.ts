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
import { addQuery, addResponse, handleResponsesInDb } from "../db/queries";
import { handleRemoteResponses } from '../endpoints';
const cron = require('node-cron');
import { ResponseEvent } from "./types";
import { config } from "bluebird";
import { exists } from "fs";
const DEFAULT_GAS = 20000000000;
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
    private oracle: any;
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
        this.oracle = null
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
        this.responders = await this.contract.MPOStorage.methods.getResponders().call();
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
        console.log(await this.contract.ZapToken.methods.balanceOf(accounts[0]).call(), await this.web3.eth.getBalance(accounts[0]));
        console.log("al", await this.contract.ZapToken.methods.allowance(accounts[0], '0xfFDff0C05d5566c50307dCBDc63b45E2e24A095D').call());
        //await this.contract.ZapToken.methods.approve('0xfFDff0C05d5566c50307dCBDc63b45E2e24A095D', 200).send({from: accounts[0], gas: 400000});
        //Transaction has been reverted by the EVM:
        //await this.contract.ZapBondage.methods.delegateBond(accounts[0], Config.contractAddress,utf8ToHex("Nonproviders"), 5).send({from: accounts[0], gas: 400000});
        //Transaction has been reverted by the EVM:
        
        const params = [utf8ToHex("ETH"), utf8ToHex("BTC"), "0x"+"0".repeat(64-"3".length)+"3"];
        this.contract.Dispatch.methods.query(Config.contractAddress, 'halo', utf8ToHex("Nonproviders"), params).send({from: accounts[0], gas: 1400000})


        console.log("Start listening to responses and saving to db");
        handleRemoteResponses((err) => console.log(err), this.responders, addResponse);

        console.log("Everty minute check for nessesary number of responses to each query and for timed out queries and then send responses to subscribers");
        cron.schedule('* * * * *', () => handleResponsesInDb(this.responders.length, this.responders, this.sendToBlockchain));
        //Transaction has been reverted by the EVM:
       /* await this.contract.ZapToken.methods.allocate(Config.public_key, 100).send({from: Config.public_key});
       // await this.contract.ZapToken.methods.approve(Config.contractAddress, 10).send({from: Config.public_key});
        console.log('halo');
        process.exit(0);
       // console.log(await this.contract.MPOStorage.methods.owner().call());
        //await this.contract.MPOStorage.methods.transferOwnership('0x6397c23f4e8914197699ba54Fc01333053C967cE').send({from: '0x6397c23f4e8914197699ba54Fc01333053C967cE'})
        this.responders = await this.contract.MPOStorage.methods.getResponders().call();
        console.log('responders:', this.responders);
        if(!this.responders) {
            this.responders = await this.contract.MPO.methods.setup(Config.EndpointSchema.responders).send({from: Config.public_key});
            if (this.responders.length) {
                console.log("list of responders is required to run Oracle");
                process.exit(1);
            }
        }
        this.respondersQuantity = await this.contract.MPOStorage.methods.getNumResponders().call();

        this.contract.MPO.events.allEvents({}, { fromBlock: 0, toBlock: 'latest' }, (err, res) => {console.log("res:", res)});

        this.mockQueries();


        console.log("Start listening to responses and saving to db");
        handleRemoteResponses((err) => console.log(err), this.responders, addResponse);

        console.log("Everty minute check for nessesary number of responses to each query and for timed out queries and then send responses to subscribers");
        cron.schedule('* * * * *', () => handleResponsesInDb(this.respondersQuantity = 5, this.responders, this.sendToBlockchain));*/
    }
    

    /**
     * Loads a ZapProvider from a given Web3 instance
     * @param web3 - WebSocket Web3 instance to load from
     * @returns ZapProvider instantiated
     */

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

    public async  mockQueries() {
        for(let i = 0; i <= 3; i++) {
            this.handleQuery(
               {
                    returnValues: {
                        id: i ? i.toString() : '999',
                        query: 'quo te agis?',
                        endpoint: '0x6892ffc6',
                        subscriber: 'subscriber',
                        endpointParams: ['0x6892ffc6'],
                        onchainSubscriber: 'onchainSubscriber'
                    }
                }
            );
        }
        const params = [utf8ToHex("ETH"), utf8ToHex("BTC"), "0x"+"0".repeat(64-"3".length)+"3"];
       // await this.contract.subscriber.methods.testQuery('0x0fDA6B12Cc079493f8A519eDa1A7c2209F429fF6', "hi", utf8ToHex("Nonproviders"), params)
        //.send({from: '0x6397c23f4e8914197699ba54Fc01333053C967cE'});    
    }

    async sendToBlockchain(responses: Object) {
        console.log('respy', responses);
       const promises = [];
        for(let queryId in responses) {
            const { hash, sigv, response, sigrs } = responses[queryId];
            promises.push(this.contract.MPO.methods.callback(
                queryId,
                response,
                hash,
                sigv,
                ...sigrs,
                ).send({from: Config.public_key, gas: DEFAULT_GAS}));
        }
        return Promise.all(promises);
    }
  }