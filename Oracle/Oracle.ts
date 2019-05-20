import {getResponse} from "./Responder";
import Config from "./Config.js";
const Web3 = require('web3');
import { ZapProvider } from "@zapjs/provider";
import {ZapToken} from "@zapjs/zaptoken"
const HDWalletProviderMem = require("truffle-hdwallet-provider");
const {toBN,fromWei, hexToUtf8} =require("web3-utils");
const assert = require("assert")
const IPFS = require("ipfs-mini")
const ipfs = new IPFS({host:'ipfs.infura.io',port:5001,protocol:'https'})
const IPFS_GATEWAY = "https://gateway.ipfs.io/ipfs/"
import {connectStatus} from "./Status";
import { addQuery, addResponse, handleResponsesInDb } from "../db/queries";
import { handleRemoteResponses } from '../endpoints';
const cron = require('node-cron');
import { ResponseEvent } from "./types";
const DEFAULT_GAS = 60000;
const MPO = require('../contracts/MultiPartyOracle.json');
const Registry = require('../contracts/Registry.json');

export  class ZapOracle {
    web3:any
    oracle:any
    zapToken:any
    respondersQuantity: any;
    contract: {
        MPO: any;
        registry: any;
    }

    constructor(){
        this.web3 = new Web3(new HDWalletProviderMem(Config.mnemonic, Config.NODE_URL))
        this.oracle = null
        this.zapToken = null
        this.sendToBlockchain = this.sendToBlockchain.bind(this);
    }
    validateConfig() {
        const EndpointSchema = Config.EndpointSchema
        assert(Config.mnemonic, "mnemonic is required to run Oracle")
        assert(Config.title, "title is required to run Oracle")
        assert(Config.public_key, "public_key is required to run Oracle")
        assert(EndpointSchema.name, "Endpoint's name is required")
        assert(EndpointSchema.curve, `Curve is required for endpoint ${EndpointSchema.name}`)
        assert(EndpointSchema.queryList.length > 0, `query list is recommended for data offer`)

    }


    /**
     * Initializes the oracle. Creates the provider if it does not exist already.
     * For each endpoint in schema, create curve and params
     * Starts listening for queries and calling handleQuery function
     */
    async initialize() {
        this.contract = {
            MPO: new this.web3.eth.Contract(MPO.abi, Config.contractAddress),
            registry: new this.web3.eth.Contract(Registry.abi, Config.contractAddress)
        }
        await this.validateConfig();
        // Get the provider and contracts
        //await this.getProvider();
        const accounts: string[] = await this.web3.eth.getAccounts();
        console.log(this.contract.registry.methods, this.contract.MPO.methods, accounts)
        await this.delay(5000)

        const title = await this.contract.registry.methods.getProviderTitle(accounts[0]).call();
        console.log(title)
        if (title.length == 0) {
            console.log("No provider found, Initializing provider");
            const res: string = await this.oracle.initiateProvider({title: Config.title, public_key: Config.public_key});
            console.log("Successfully created oracle", Config.title);
        }
        else {
            console.log("Oracle exists");
            if( title != Config.title){
              console.log("Changing title")
              const res:string = await this.oracle.setTitle({title:Config.title})
              console.log("Successfully changed Title : ",res)

            }
        }
        //Create endpoints if not exists
        const endpoint = Config.EndpointSchema
        let curveSet = await this.oracle.isEndpointCreated(endpoint.name)
        if (!curveSet) {
            //create endpoint
            console.log("No matching Endpoint found, creating endpoint")
            if(endpoint.broker == "")
                endpoint.broker = "0x0000000000000000000000000000000000000000"
            const createEndpoint = await this.oracle.initiateProviderCurve({endpoint: endpoint.name, term: endpoint.curve, broker: endpoint.broker});
            console.log("Successfully created endpoint ", createEndpoint)
            //setting endpoint params with indexed query string
            let endpointParams:string[] = []
            for(let query of endpoint.queryList){
                endpointParams.push("Query string :"+ query.query +", Query params :"+JSON.stringify(query.params)+", Response Type: "+query.responseType)
            }
            console.log("Setting endpoint params")

            const txid = await this.oracle.setEndpointParams({endpoint: endpoint.name, endpoint_params: endpointParams})
            console.log(txid)
            // setting {endpoint.json} file and save it to ipfs
            let ipfs_endpoint:any = {}
            ipfs_endpoint.name =  endpoint.name
            ipfs_endpoint.curve = endpoint.curve
            ipfs_endpoint.broker = endpoint.broker
            ipfs_endpoint.params = endpointParams
            // add to ipfs file
            console.log("Saving Endpoint info into ipfs")
            ipfs.addJSON(ipfs_endpoint,(err:any,res:any)=>{
                if(err){
                    console.error("Fail to save endpoint data to ipfs : ", ipfs_endpoint)
                    process.exit(err)
                }
                //save ipfs hash to this.oracle param
                console.log("Successfully saved Endpoint json file into ipfs, saving ipfs link to oracle's params")
                this.oracle.setProviderParameter({key:`${endpoint.name}.json`,value:IPFS_GATEWAY+res})
                    .then((txid:string)=>{console.log("saved endpoint info to param with hash : ",res,txid)})
            })
            //if there is a md string => save to provider params
            if(endpoint.md && endpoint.md!=""){
                ipfs.add(endpoint.md,(err:any,res:any)=>{
                  if(err){
                      console.error("Fail to save endpoint .md file to ipfs", endpoint)
                      process.exit(err)
                  }
                  //set ipfs hash as provider param
                  this.oracle.setProviderParameter({key:`${endpoint.name}.md`,value:IPFS_GATEWAY+res})
                    .then((txid:string)=>{console.log("saved endpoint info to param with hash : ",res,txid)})

                })
            }
            else{
              console.log("No md value file, skipping")
            }
            this.contract.MPO.methods.setParams(
                    endpoint.responders,
                    endpoint.responders)
                    .send({from: Config.public_key, gas: DEFAULT_GAS});
            this.respondersQuantity =  endpoint.responders.length;
        } else {
           this.respondersQuantity = this.contract.MPO.methods.getNumResponders(
                    endpoint.responders,
                    endpoint.responders)
                    .call({from: Config.public_key, gas: DEFAULT_GAS});
          //Endpoint is initialized, so ignore all the setup part and listen to Query
            console.log("curve is already  set : ", await this.oracle.getCurve(endpoint.name))
        }
        //UPDATE STATUS TO ZAP
        connectStatus(this.web3,endpoint)

        console.log("Start listening to queries and saving to db");
        this.oracle.listenQueries({}, (err: any, event: any) => {
            if (err) {
                throw err;
            }
            this.handleQuery(event);
        });
        this.mockQueries();


        console.log("Start listening to responses and saving to db");
        handleRemoteResponses((err) => console.log(err), addResponse);

        console.log("Everty minute check for nessesary number of responses to each query and for timed out queries and then send responses to subscribers");
        cron.schedule('* * * * *', () => handleResponsesInDb(this.respondersQuantity || 5, this.sendToBlockchain));
    }
    

    /**
     * Loads a ZapProvider from a given Web3 instance
     * @param web3 - WebSocket Web3 instance to load from
     * @returns ZapProvider instantiated
     */

    delay = (ms:number) => new Promise(_ => setTimeout(_, ms));
    async getProvider() {
        // loads the first account for this web3 provider
        const accounts: string[] = await this.web3.eth.getAccounts();
        if (accounts.length == 0) throw('Unable to find an account in the current web3 provider, check your Config variables');
        const owner: string = accounts[0];
        this.oracle = new ZapProvider(owner, {
            networkId: (await this.web3.eth.net.getId()).toString(),
            networkProvider:this.web3.currentProvider
        });
        this.zapToken = new ZapToken({
            networkId: (await this.web3.eth.net.getId()).toString(),
            networkProvider:this.web3.currentProvider
        })
        const ethBalance = await this.web3.eth.getBalance(owner)
        const zapBalance = await this.zapToken.balanceOf(owner)
        console.log("Wallet contains:", fromWei(ethBalance,"ether"),"ETH ;", fromWei(zapBalance,"ether"),"ZAP");
    }

  
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
        console.log(results)
        console.log(`Received query to ${event.endpoint} from ${event.onchainSub ? 'contract' : 'offchain subscriber'} at address ${event.subscriber}`);
        console.log(`Query ID ${event.queryId.substring(0, 8)}...: "${event.query}". Parameters: ${event.endpointParams}`);
        await addQuery(event);   
    }

    public mockQueries() {
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
                sigrs,
                ).send({from: Config.public_key, gas: DEFAULT_GAS}));
        }
        return Promise.all(promises);
    }
  }