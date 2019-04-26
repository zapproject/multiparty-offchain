import * as Web3 from 'web3';
import * as HDWalletProvider from 'truffle-hdwallet-provider';
import * as assert from 'assert';
import { ZapProvider } from "@zapjs/provider";
import { ZapToken } from "@zapjs/zaptoken"
import { config } from "./config";
import { Endpoints } from "./Schema";
import { QueryEvent, EndpointSchema } from "./types";
import { DEFAULT_GAS } from "@zapjs/types";
import { addQuery } from "../db/queries";
import { getProvider } from "./utils";


export class Oracle {
  web3: any;
  constructor() {
    this.web3 = new Web3(new HDWalletProvider(config.mnemonic, config.NODE_WS))
  }
  /**
   * Initializes the oracle. Creates the provider if it does not exist already.
   * For each endpoint in schema, create curve and params
   * Starts listening for queries and calling handleQuery function
   */
  async initialize() {
    this.validateSchema();
    const provider = await getProvider(this.web3);
    const title = await provider.getTitle();
    if (title.length === 0) {
      console.log('No provider found, Initializing provider');
      const res: string = await provider.initiateProvider({title: config.title, public_key: config.public_key});
      console.log(res);
      console.log('Successfully created oracle', config.title);
    } else {
      console.log(`Oracle ${title} exists`);
    }

    //Create endpoints if not exists
    for (const endpoint of Endpoints) {
      const curveSet = await provider.isEndpointCreated(endpoint.name);
      if (!curveSet) {
        //create endpoint
        console.log('create endpoint')
        const createEndpoint = await provider.initiateProviderCurve({
          endpoint: endpohttp://git.smartum.pro/Zap/oracle-coinmarketcap.gitint.name,
          term: endpoint.http://git.smartum.pro/Zap/oracle-coinmarketcap.gitcurve
        });http://git.smartum.pro/Zap/oracle-coinmarketcap.git
        console.log('Succhttp://git.smartum.pro/Zap/oracle-coinmarketcap.gitessfully created endpoint', createEndpoint)
      } else {
        console.log(`curve ${endpoint.name} is set:`, await provider.getCurve(endpoint.name));
      }

      //Right now each endpoint can only store 1 set of params, so not storing params for more flexibility
      // else {
      //     //check params
      //     let params = await provider.getEndpointParams(endpoint.name)
      //     if (params.length == 0 && endpoint.params.length > 1) {
      //         await provider.setEndpointParams({endpoint: endpoint.name, params: endpoint.params}) //todo zapjs needs to implement this
      //     }
      // }

      provider.listenQueries({}, (err: any, event: any) => {
        if (err) throw err;
        this.handleQuery(provider, endpoint, event);
      });
    }
  }

  private validateSchema() {
    for (let endpoint of Endpoints) {
      assert.ok(endpoint.name, 'Endpoint\'s name is required');
      assert.ok(endpoint.curve, `Curve is required for endpoint ${endpoint.name}`);
      assert.ok(endpoint.curve.length >= 3, `Curve's length is invalid for endpoint ${endpoint.name}`);
      assert.ok(endpoint.queryList && endpoint.queryList.length > 0, `query list is required for data offer`);
    }
  }

  /**
   * Handles a query
   * @param writer - HTTP Web3 instance to respond to query with
   * @param queryEvent - Web3 incoming query event
   * @returns ZapProvider instantiated
   */
  async handleQuery(provider: ZapProvider, endpoint: EndpointSchema, queryEvent: any): Promise<void> {
    const results: any = queryEvent.returnValues;

    // Parse the event into a usable JS object
    const event: QueryEvent = {
      queryId: results.id,
      query: results.query,
      endpoint: this.web3.utils.hexToUtf8(results.endpoint),
      subscriber: results.subscriber,
      endpointParams: results.endpointParams.map(this.web3.utils.hexToUtf8),
      onchainSub: results.onchainSubscriber,
    }
    if (event.endpoint !== endpoint.name) {
      console.log('Unable to find the callback for', event.endpoint);
      return;
    }

    console.log(`Received query to ${event.endpoint} from ${event.onchainSub ? 'contract' : 'offchain subscriber'} at address ${event.subscriber}`);
    console.log(`Query ID ${event.queryId.substring(0, 8)}...: "${event.query}". Parameters: ${event.endpointParams}`);

    await addQuery(event)

    // await delay(5000);
    /* for (let query of endpoint.queryList) {
      const response = await query.getResponse(event);
      console.log('response', response);
      console.log('event.queryId', event.queryId);
      // Send the response
      provider.respond({
        queryId: event.queryId,
        responseParams: response,
        dynamic: false,
        gas: DEFAULT_GAS,
      }).then((txid: any) => {
        console.log('Responded to', event.subscriber, "in transaction", txid.transactionHash);
      }).catch((e) => {
        console.error(e)
        throw new Error(`Error responding to query ${event.queryId} : ${e}`)
      });
    } */
  }
}
