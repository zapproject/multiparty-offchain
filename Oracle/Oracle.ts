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
import { addQuery, handleResponsesInDb, addResponseToDb, flushResponded } from "../db/queries";
import { handleRemoteResponses } from '../endpoints';
const cron = require('node-cron');
import { ZapDispatch } from "@zapjs/dispatch/lib/src";
const DEFAULT_GAS = 10000000;
const MPO = require('../contracts/MultiPartyOracle.json');
const MPOStorage = require('../contracts/MPOStorage.json');
const Dispatch = require("../contracts/Dispatch.json");
const EventEmitter = require('events');

export  class ZapOracle {
    private web3: any;
    private oracle: any;
    private zapToken: any
    private respondersQuantity: number = 3;
    private responders: Array<string>; 
    private eventEmitter;
    contract: {
        MPO: any;
        MPOStorage: any;
        Dispatch: any;
    }

    constructor(){
        this.web3 = new Web3(new HDWalletProviderMem(Config.mnemonic, Config.NODE_URL))
        this.oracle = null
        this.zapToken = null
        this.sendToBlockchain = this.sendToBlockchain.bind(this);
        this.eventEmitter =  new EventEmitter();
    }

    validateConfig() {
        assert(Config.mnemonic, "mnemonic is required to run Oracle")
        assert(Config.title, "title is required to run Oracle")
        assert(Config.public_key, "public_key is required to run Oracle")
    }

    async initialize() {
        this.contract = {
            MPO: new this.web3.eth.Contract(MPO.abi, Config.contractAddress),
            MPOStorage: new this.web3.eth.Contract(MPOStorage.abi, '0xb116b3f8dfa62b3d1c279abf66df6b4bc85a1108'),
            Dispatch: new this.web3.eth.Contract(Dispatch.abi, '0x6b6AFD3FC0a7f47d48f9C5Fc13375a40E70BbBD3')
        },

        this.responders = (await this.contract.MPOStorage.methods.getResponders().call()).map(res => res.toUpperCase());
        
        this.respondersQuantity = this.responders.length;
        const latest = await this.web3.eth.getBlockNumber()
        const incomingEvents = await this.contract.MPO.getPastEvents('Incoming', { fromBlock: latest - 50000, toBlock: 'latest' });
        await Promise.all(incomingEvents.map(event => this.handleQuery(event)));
        const responseEvents = await this.contract.Dispatch.getPastEvents('OffchainResponseInt', {filter: {'provider': Config.contractAddress}, fromBlock: 0});
        const responsedIds = responseEvents.map(({id}) => id);
        await flushResponded(responsedIds, this.eventEmitter);
        this.contract.MPO.events.Incoming((err, event) => setTimeout(() => this.handleQuery(event).catch(console.log), 15000));
        this.contract.Dispatch.events.OffchainResponseInt((err, event) => {
            if(err) {
                console.log(err);
            } else {
                flushResponded([event.id], this.eventEmitter);
            }
        })

        console.log("Start listening to responses and saving to db");
        handleRemoteResponses((err) => console.log(err), this.responders, (event) => addResponseToDb(this.responders, event), this.eventEmitter);

        console.log("Everty minute check for nessesary number of responses to each query and for timed out queries and then send responses to subscribers");
        cron.schedule('* * * * *', () => handleResponsesInDb(this.sendToBlockchain, this.eventEmitter).catch(console.log));
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
        //let response: string[] | number[]
        // Parse the event into a usable JS object
        const event: any = {
            queryId: await this.contract.MPOStorage.methods.getClientQueryId(results.id).call(),
            mpoId: results.id,
            query: results.query,
            threshold: results.endpointParams && results.endpointParams[2] ? parseInt(results.endpointParams[2].split('x')[1]) || 3 : 3,
            endpoint: (results.endpoint),//hexToUtf8(results.endpoint),
            subscriber: results.subscriber,
            provider: results.provider,
            endpointParams: results.endpointParams,//.map(hexToUtf8),
            onchainSubscriber: results.onchainSubscriber
        }
        console.log(parseInt(results.endpointParams[2].split('x')[1]))
        console.log(`Received query to ${event.endpoint} from ${event.onchainSub ? 'contract' : 'offchain subscriber'} at address ${event.subscriber}`);
        console.log(`Query ID ${event.queryId.substring(0, 8)}...: "${event.query}". Parameters: ${event.endpointParams}`);
        await addQuery(event, this.eventEmitter);   
    }

    async sendToBlockchain(responses: Object) {
       const log = [];
        for(let queryId in responses) {
            let { hash, sigv, response, sigrs } = responses[queryId];
            try {
                await this.contract.MPO.methods.callback(
                    responses[queryId]['mpoId'][0],
                    response,
                    hash,
                    sigv,
                    [...sigrs],
                ).send({from: Config.public_key, gas: DEFAULT_GAS});
                log.push({err:null, queryId});
            } catch(err) {log.push({err, queryId});}  
        }
        return log;
    }
}