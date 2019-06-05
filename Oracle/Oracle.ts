import Config from "./Config.js";
const Web3 = require('web3');
const HDWalletProviderMem = require("truffle-hdwallet-provider");
const assert = require("assert")
import { addQuery, addResponseToDb, handleResponsesInDb } from "../db/queries";
import { handleRemoteResponses } from '../endpoints';
const cron = require('node-cron');
const DEFAULT_GAS = 100000;
const MPO = require('../contracts/MultiPartyOracle.json');
const MPOStorage = require('../contracts/MPOStorage.json');
const GAS_PRICE = 20000000000;

export  class ZapOracle {
    private web3: any;
    private aggregator: any;
    private responders: Array<string>; 
    transactionFinished: boolean;
    contract: {
        MPO: any;
        MPOStorage: any;
    }

    constructor(){
        this.web3 = new Web3(new HDWalletProviderMem(Config.mnemonic, Config.NODE_URL));
        this.aggregator = null;
        this.sendToBlockchain = this.sendToBlockchain.bind(this);
        this.transactionFinished = true;
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

        this.responders = (await this.contract.MPOStorage.methods.getResponders().call()).map(res => res.toUpperCase());

        if(!this.responders) {
            this.responders = await this.contract.MPO.methods.setup(Config.EndpointSchema.responders).send({from: Config.public_key,  gas: DEFAULT_GAS, gasPrice: GAS_PRICE});
            if (this.responders.length) {
                console.log("list of responders is required to run Oracle");
                process.exit(1);
            }
        }

        this.contract.MPO.events.Incoming(
            {}, (err, res) => {
                this.handleQuery(res);
            }
        );
        
        const accounts: string[] = await this.web3.eth.getAccounts();
        this.aggregator = accounts[0];

        console.log("Start listening to responses and saving to db");
        handleRemoteResponses((err) => console.log(err), this.responders, addResponseToDb);

        console.log("Everty minute check for nessesary number of responses to each query and for timed out queries and then send responses to subscribers");
        cron.schedule('* * * * *', () => {
            if (this.transactionFinished) {
                handleResponsesInDb(this.responders.length, this.responders, this.sendToBlockchain);
            }
        });

    }
    

    async handleQuery(queryEvent: any): Promise<void> {
        console.log('event', queryEvent)
        const results: any = queryEvent.returnValues;
        const event: any = {
            queryId: results.id,
            query: results.query,
            endpoint: (results.endpoint),
            subscriber: results.subscriber,
            endpointParams: results.endpointParams,
            onchainSub: results.onchainSubscriber
        }

        await addQuery(event);   
    }

    async sendToBlockchain(responses: Object) {
        this.transactionFinished = false;
        const responded = [];
        for(const queryId of Object.keys(responses)) {
            const { hash, sigv, response, sigrs } = responses[queryId];
            await this.contract.MPO.methods.callback(
                new String(queryId).valueOf(),
                response,
                hash,
                sigv,
                sigrs
                ).send({from: this.aggregator, gas: DEFAULT_GAS, gasPrice: GAS_PRICE})
                .on('error', function(error){ return {error, responded} });
            responded.push(queryId);
        };
        this.transactionFinished = true;
        return true;
    }

    /*async sendToBlockchain(responses: Object) {
        this.transactionFinished = false;
        console.log('respy', responses);
        const currentNonce = await this.web3.eth.getTransactionCount(this.aggregator);
        console.log('currentNonce: ', currentNonce);
        const responsePromises = [];
        for(const [index, queryId] of Object.keys(responses).entries()) {
            const { hash, sigv, response, sigrs } = responses[queryId];
            console.log(index, queryId)
            responsePromises.push(this.contract.MPO.methods.callback(
                new String(queryId).valueOf(),
                response,
                hash,
                sigv,
                sigrs
                ).send({from: this.aggregator, gas: DEFAULT_GAS, gasPrice: 20000000000, nonce: '0x'+(currentNonce + index + 1).toString('hex')})
                .on('error', function(error){ console.log(error); return new Error(error) }));
        };
        console.log(responsePromises)
        const promRet = await Promise.all(responsePromises);
        console.log('promRet', promRet);
        this.transactionFinished = true;
        return true;
    }*/
  }