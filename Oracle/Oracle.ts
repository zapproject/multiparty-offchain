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
import { addQuery, handleResponsesInDb, addResponseToDb } from "../db/queries";
import { handleRemoteResponses } from '../endpoints';
const cron = require('node-cron');
import { ResponseEvent } from "./types";
import { config } from "bluebird";
import { exists } from "fs";
import { throws } from "assert";
const DEFAULT_GAS = 20000000000;
const MPO = require('../contracts/MultiPartyOracle.json');
const MPOStorage = require('../contracts/MPOStorage.json');
const Registry = require('../contracts/Registry.json');
const Subscriber = require("../contracts/TestClient.json");
const Coordinator = require("../contracts/ZapCoordinator.json");
const Token = require("../contracts/ZapToken.json");

export  class ZapOracle {
    private web3: any;
    private oracle: any;
    private zapToken: any
    private respondersQuantity: number = 1;
    private responders: Array<string>; 
    contract: {
        MPO: any;
        MPOStorage: any;
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
        this.contract = {
            MPO: new this.web3.eth.Contract(MPO.abi, Config.contractAddress),
            MPOStorage: new this.web3.eth.Contract(MPOStorage.abi, '0xb116b3f8dfa62b3d1c279abf66df6b4bc85a1108')
        }
        //const accounts: string[] = await this.web3.eth.getAccounts();
       // this.respondersQuantity = await this.contract.MPOStorage.methods.getNumResponders().call();
        //await this.contract.Token.allocate(Config.contractAddress, '1000', { from: Config.contractAddress });
      //  //await this.contract.Token.allocate.allocate(allocAddress, tokensForSubscriber, { from: owner });
        //console.log(1, await this.contract.Token.methods.approve('0xE8F948e52120Ef8ef6b30414C9336CEfc8DE825C', 1000)
        //.send({from: '0x6397c23f4e8914197699ba54Fc01333053C967cE'}));
        //console.log(this.respondersQuantity)
        this.responders = (await this.contract.MPOStorage.methods.getResponders().call()).map(res => res.toUpperCase());

        /*if(!this.responders) {
            this.responders = await this.contract.MPO.methods.setup(Config.EndpointSchema.responders).send({from: Config.public_key,  gas: DEFAULT_GAS, gasPrice: GAS_PRICE});
            if (this.responders.length) {
                console.log("list of responders is required to run Oracle");
                process.exit(1);
            }
        }*/
        //console.log(this.contract.MPO.events)
        this.contract.MPO.getPastEvents('Incoming', { fromBlock: 0, toBlock: 'latest' }, (err, events) => 
        Promise.all(events.map(event => this.handleQuery(event).then(console.log).catch(console.log))));

        //this.mockQueries();


        console.log("Start listening to responses and saving to db");
        handleRemoteResponses((err) => console.log(err), this.responders, (event) => addResponseToDb(this.responders, event));
       

        console.log("Everty minute check for nessesary number of responses to each query and for timed out queries and then send responses to subscribers");
        cron.schedule('* * * * *', () => handleResponsesInDb(this.respondersQuantity, this.responders, this.sendToBlockchain));
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
            onchainSubscriber: results.onchainSubscriber
        }
        console.log(results)
        console.log(`Received query to ${event.endpoint} from ${event.onchainSub ? 'contract' : 'offchain subscriber'} at address ${event.subscriber}`);
        console.log(`Query ID ${event.queryId.substring(0, 8)}...: "${event.query}". Parameters: ${event.endpointParams}`);
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
                ).send({from: Config.public_key, gas: DEFAULT_GAS})
                .then(() => console.log('responded:', queryId))
                .catch(err => queryId))
        }
        return Promise.all(promises);
    }
  }