import {getResponse} from "./Responder";
import Config from "./Config.js";
const Web3 = require('web3');
const assert = require("assert")
import { getSignature } from './utils';
const fetch = require('node-fetch');
const MPO = require('../contracts/MultiPartyOracle.json');

export  class ZapOracle {
    web3:any
    oracle:any
    zapToken:any
    respondersQuantity: any;
    contract: {
        MPO: any;
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
        }
        this.contract.MPO.events.Incoming({}, (err, event) => {
             this.handleQuery(event);
        })
    }


    async handleQuery(queryEvent: any): Promise<void> {
        const results: any = queryEvent.returnValues;
        let response: string[] | number[]
        if(!results.id) return;
        const event: any = {
            queryId: results.id,
            query: results.query,
            endpoint: (results.endpoint),
            subscriber: results.subscriber,
            endpointParams: results.endpointParams,
            onchainSub: results.onchainSubscriber
        }

        response = await getResponse(event) as unknown as string[] | number[];
        const signature = await getSignature(response);
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