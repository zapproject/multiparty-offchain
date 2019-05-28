import Config from "./Config.js";
const Web3 = require('web3');
import { ZapProvider } from "@zapjs/provider";
import {ZapToken} from "@zapjs/zaptoken"
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

export  class ZapOracle {
    private web3: any;
    private oracle: any;
    private zapToken: any
    private respondersQuantity: number;
    private responders: Array<string>; 
    contract: {
        MPO: any;
        registry: any;
        subscriber: any;
        MPOStorage: any;
        Coordinator: any;
    }

    constructor(){
        this.web3 = new Web3(new HDWalletProviderMem(Config.mnemonic, Config.NODE_URL))
        this.oracle = null
        this.zapToken = null
        this.sendToBlockchain = this.sendToBlockchain.bind(this);
    }
    validateConfig() {
        assert(Config.mnemonic, "mnemonic is required to run Oracle")
        assert(Config.title, "title is required to run Oracle")
        assert(Config.public_key, "public_key is required to run Oracle")
    }

    async initialize() {
       /*this.contract = {
            MPO: new this.web3.eth.Contract(MPO.abi, Config.contractAddress),
            MPOStorage: new this.web3.eth.Contract(MPOStorage.abi, "0x0fDA6B12Cc079493f8A519eDa1A7c2209F429fF6"),
            registry: new this.web3.eth.Contract(Registry.abi, Config.contractAddress),
            subscriber: new this.web3.eth.Contract(Subscriber.abi, Config.contractAddress),
            Coordinator: new this.web3.eth.Contract(Coordinator.abi, Config.contractAddress),
        }
        const accounts: string[] = await this.web3.eth.getAccounts();
        console.log(await this.contract.MPOStorage.methods.owner().call());
        await this.contract.MPOStorage.methods.transferOwnership('0x6397c23f4e8914197699ba54Fc01333053C967cE').send({from: '0x6397c23f4e8914197699ba54Fc01333053C967cE'})
        this.responders = await this.contract.MPO.methods.getResponders().call();
        if(!this.responders.length) {
            this.responders = await this.contract.MPO.methods.setup(Config.EndpointSchema.responders).send({from: Config.public_key});
            if (this.responders.length) {
                console.log("list of responders is required to run Oracle");
                process.exit(1);
            }
        }
        this.respondersQuantity = await this.contract.MPOStorage.methods.getNumResponders().call();

        this.contract.MPO.events.allEvents({}, { fromBlock: 0, toBlock: 'latest' }, (err, res) => {console.log("res:", res)});*/

        this.mockQueries();


        console.log("Start listening to responses and saving to db");
        handleRemoteResponses((err) => console.log(err), this.responders, addResponse);

        console.log("Everty minute check for nessesary number of responses to each query and for timed out queries and then send responses to subscribers");
        cron.schedule('* * * * *', () => handleResponsesInDb(this.respondersQuantity = 5, this.responders, this.sendToBlockchain));
    }
    

    /**
     * Loads a ZapProvider from a given Web3 instance
     * @param web3 - WebSocket Web3 instance to load from
     * @returns ZapProvider instantiated
     */

    delay = (ms:number) => new Promise(_ => setTimeout(_, ms));

    async handleQuery(queryEvent: any): Promise<void> {
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