import {getResponse} from "./Responder";
import Config from "./Config.js";
const Web3 = require('web3');
import {ZapToken} from "@zapjs/zaptoken"
const {utf8ToHex, toBN, hexToUtf8, bytesToHex, hexToBytes, toHex, fromWei} = require("web3-utils");
const assert = require("assert")
const IPFS = require("ipfs-mini")
import { connectStatus } from "./Status";
import { getSignature } from './utils';
const fetch = require('node-fetch');
const MPO = require('../contracts/MultiPartyOracle.json');
const MPOStorage = require('../contracts/MPOStorage.json');
const Registry = require('../contracts/Registry.json');
const Subscriber = require("../contracts/TestClient.json");
const Coordinator = require("../contracts/ZapCoordinator.json");
const eutil = require('ethereumjs-util');

export  class ZapOracle {
    web3:any
    oracle:any
    zapToken:any
    respondersQuantity: any;
    contract: {
        MPO: any;
        registry: any;
        subscriber: any;
        MPOStorage: any;
        Coordinator: any;
    }

    constructor(){
        this.web3 = new Web3(Config.NODE_URL);
        this.sendToServer = this.sendToServer.bind(this);
    }
    validateConfig() {
        assert(Config.mnemonic, "mnemonic is required to run Oracle")
    }

    async initialize() {
       
       this.contract = {
            MPO: new this.web3.eth.Contract(MPO.abi, Config.contractAddress),
            MPOStorage: new this.web3.eth.Contract(MPOStorage.abi, "0x0fDA6B12Cc079493f8A519eDa1A7c2209F429fF6"),
            registry: new this.web3.eth.Contract(Registry.abi, Config.contractAddress),
            subscriber: new this.web3.eth.Contract(Subscriber.abi, Config.contractAddress),
            Coordinator: new this.web3.eth.Contract(Coordinator.abi, Config.contractAddress),
        }
        const accounts: string[] = await this.web3.eth.getAccounts();
        
        this.contract.MPO.events.allEvents({}, { fromBlock: 0, toBlock: 'latest' }, (err, event) => {
             this.handleQuery(event);
        })
       // await this.mockQueries();
    }

    /**
     * Loads a ZapProvider from a given Web3 instance
     * @param web3 - WebSocket Web3 instance to load from
     * @returns ZapProvider instantiated
     */

    delay = (ms:number) => new Promise(_ => setTimeout(_, ms));
  
//==============================================================================================================
// Query Handler
//==============================================================================================================

    /**
     * Handles a query
     * @param writer - HTTP Web3 instance to respond to query with
     * @param queryEvent - Web3 incoming query event
     * @returns ZapProvider instantiated
     */

    async handleQuery(queryEvent: any): Promise<void> {
        const results: any = queryEvent.returnValues;
        let response: string[] | number[]
        // Parse the event into a usable JS object
        if(!results.id) return;
        const event: any = {
            queryId: results.id,
            query: results.query,
            endpoint: (results.endpoint),//hexToUtf8(results.endpoint),
            subscriber: results.subscriber,
            endpointParams: results.endpointParams,//.map(hexToUtf8),
            onchainSub: results.onchainSubscriber
        }

       /* if (event.endpoint != Config.EndpointSchema.name) {
            console.log('Unable to find the callback for', event.endpoint);
            return;
        }*/
        //console.log(results)
        //console.log(`Received query to ${event.endpoint} from ${event.onchainSub ? 'contract' : 'offchain subscriber'} at address ${event.subscriber}`);
      //  console.log(`Query ID ${event.queryId.substring(0, 8)}...: "${event.query}". Parameters: ${event.endpointParams}`);
        response = await getResponse(event) as unknown as string[] | number[];
        const signature = await getSignature(response);
       

        //const {r,s} = rawSignature;
       // const signature = {...rawSignature, r: r.toString('hex'), s: s.toString('hex')};
        //console.log(signature);
        this.sendToServer({response, signature, queryId: event.queryId})
    }

    sendToServer(request) {
        fetch(
            Config.SERVER_URL,
            {
                method: 'POST',
                body: JSON.stringify(request)
            }
        )
        .then(res => res.text())
        .then(body => console.log(body));
    }
  }