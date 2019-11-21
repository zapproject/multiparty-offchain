import knex from './knex';
import { QueryEvent, ResponseEvent } from '../Oracle/types';
import Config from "../Oracle/Config.js";
import {getInfo} from './infoQueries';
const eutil = require('ethereumjs-util');


export enum QueryStatus {
  Scheduled,
  Running,
  Completed,
};

export function addQuery(event: QueryEvent): any {
  console.log(event);
 return knex('queries').insert({
    queryId: String(event.queryId),
    query: event.query,
    subscriber: event.subscriber,
    endpoint: event.endpoint,
    endpointParams: event.endpointParams.join(','),
    onchainSubscriber: event.onchainSubscriber,
    received: new Date()
  }).returning('id');
}

export async function addResponseToDb(responders: Array<string>, event: ResponseEvent): Promise<any> {
  const { response } = event;
  const signature = event.signature;
  const msgHash = eutil.hashPersonalMessage(Buffer.from(response.toString()));
  const hash = '0x' + msgHash.toString('hex');
  //const sig = '0x'+signature.toString('hex');
  const sigv = parseInt(signature.v.toString(10));//!
  const sigrs = [];
  sigrs.push('0x' + Buffer.from(signature.r.data).toString('hex'));
  sigrs.push('0x' + Buffer.from(signature.s.data).toString('hex'));
  const pubkey = eutil.ecrecover(msgHash, signature.v, signature.r.data, signature.s.data);
  const addrBuf = eutil.pubToAddress(pubkey);
  const addr = eutil.bufferToHex(addrBuf);
  if (responders.indexOf(addr.toUpperCase()) == -1) {
    throw `Public key not listed in contract: ${addr}`;
  } 
  return await knex('responses').insert({
    queryId: String(event.queryId),
    response,
    hash,
    sigv,
    sigrs: JSON.stringify(sigrs),
    addr,
    status: 'Active'
  }).returning('id');
}

export function flushResponded(keys) {
  return knex.transaction(function(trx) {
    let idsList;
    return trx.select('queryId')
    .from('queries')
    .where('received', '<', new Date(Date.now() - Config.timeout))
    .orWhere('queryId', 'undefined')
    .then(async ids => {
      console.log(ids, keys);
      idsList = ids.map(item => item.queryId).concat(keys);
      return knex('queries')
      .whereIn('queryId', idsList)
      .del()
    })
    .then(() => {
      return knex('responses')
      .whereIn('queryId', idsList)
      .del()
    })
    .then(() => idsList);
  });
}

export function restoreNotResponded(keys) {
  return Promise.all([
    knex('responses')
    .whereIn('queryId', keys)
    .update('status', 'Active')
  ]);
}

export function getResponses(count) {
    return knex.transaction(function(trx) {
      let idsList;
      return trx.select('queryId')
      .from('responses')
      .whereNot('status', 'toDelete')
      .groupBy('queryId')
      .having(knex.raw(`count(*) >= ${count}`))
      .then(async ids => {
        idsList = ids.map(item => item.queryId);
        return knex('responses')
        .transacting(trx)
        .whereIn('queryId', idsList)
        .update('status', 'toDelete')
      })
      .then(() => {
        console.log('ids', idsList);
        return trx.select('*').from('responses')
        .whereIn('queryId', idsList);
      })
    });  
}

export async function handleResponsesInDb(quantity: number, reponders: any, callContractRespond) {
  const responses = await getResponses(quantity);
  const queriesList = responses.reduce((obj, { hash, sig, sigv, sigrs: _sigrs, response, queryId}) => {
    const sigrs = JSON.parse(_sigrs);
    if(!obj[queryId]) obj[queryId] = {hash: [], sigv: [], sigrs: [], response: []};
    return {...obj, [queryId]: {
      hash: [new String(hash).valueOf()],
      sigv: [new String(sigv).valueOf()],
      sigrs: [new String(sigrs[0]).valueOf(), new String(sigrs[1]).valueOf()],
      response: [new String(response).valueOf()]
    }}}, 
  {});

  if (responses.length) {
    try {
      const errorsSending = (await callContractRespond(queriesList)).filter(item => typeof item !== 'undefined');
      await restoreNotResponded(errorsSending);
    } catch(err) {
      console.log(err);
      return;
    }
  }

  console.log('deleted', await flushResponded(Object.keys(queriesList)));
}