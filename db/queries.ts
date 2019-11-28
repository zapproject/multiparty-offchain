import knex from './knex';
import { QueryEvent, ResponseEvent } from '../Oracle/types';
import Config from "../Oracle/Config.js";
import {getInfo} from './infoQueries';
import { reduce } from 'bluebird';
const eutil = require('ethereumjs-util');


export enum QueryStatus {
  Scheduled,
  Running,
  Completed,
};

export function addQuery(event: QueryEvent, eventEmitter: any): any {
  const _event = {
    queryId: String(event.queryId),
    mpoId: String(event.mpoId),
    query: event.query,
    subscriber: event.subscriber,
    provider: event.provider,
    threshold: event.threshold,
    endpoint: event.endpoint,
    endpointParams: event.endpointParams.join(','),
    onchainSubscriber: event.onchainSubscriber,
    received: new Date()
  };
  knex('queries').insert(_event).then(() => eventEmitter.emit('add', _event));
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
  const queryMposList = (await knex('queries').select('mpoId')).map(({mpoId}) => mpoId);
  if(queryMposList.indexOf(event.mpoId) === -1) {
    return;
  }
  return await knex('responses').insert({
    queryId: String(event.queryId),
    mpoId: String(event.mpoId),
    response,
    hash,
    sigv,
    sigrs: JSON.stringify(sigrs),
    addr,
    status: 'Active'
  }).returning('id');
}

export function flushResponded(keys, eventEmitter) {
  if(!keys.length) {
    return 0;
  }
  return knex.transaction(function(trx) {
    let idsList;
    return trx.select('queryId')
    .from('queries')
    .where('received', '<', new Date(Date.now() - Config.timeout))
    .orWhere('queryId', 'undefined')
    .then(async ids => {
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
    .then(() => eventEmitter.emit('delete', idsList))
    .then(() => idsList).catch(console.log);
  });
}

export function getResponses() {
  return knex('responses').select('queryId', knex.raw('count(mpoId)')).groupBy('queryId')
  .then(item => {
    return Promise.all(item.map(cur => knex('queries').select('queryId').where('queryId', cur.queryId).andWhere('threshold', '<=', cur['count(mpoId)'])));
  })
  .then(async idList => {
    const queryList: any = idList.reduce((res: string[], cur) => {
      if(cur[0] && cur[0]['queryId']) {
        res.push(cur[0]['queryId']);
      }
      return res;
    }, []);
    try {
      return await knex('responses').select('*')
      .whereIn('queryId', queryList);
    } catch(err) {
      console.log(err);
      return [];

    }
  })
}

export async function handleResponsesInDb(callContractRespond, eventEmitter: any) {
  const responses = await getResponses();
  const queriesList = responses.reduce((obj, { hash, sig, sigv, sigrs: _sigrs, response, queryId, mpoId}) => {
    const sigrs = JSON.parse(_sigrs);
    if(!obj[queryId]) obj[queryId] = {hash: [], sigv: [], sigrs: [], response: [], mpoId: []};
    return {...obj, [queryId]: {
      mpoId: [...obj[queryId]['mpoId'], new String(mpoId).valueOf()],
      hash: [...obj[queryId]['hash'], new String(hash).valueOf()],
      sigv: [...obj[queryId]['sigv'], new String(sigv).valueOf()],
      sigrs: [...obj[queryId]['sigrs'], new String(sigrs[0]).valueOf(), new String(sigrs[1]).valueOf()],
      response: [...obj[queryId]['response'], new Number(response).valueOf()]
    }}}, 
  {});

  let logSending = {success: [], err: []}; 
  if (responses.length) {
    try {
      logSending = (await callContractRespond(queriesList)).reduce(
        (res, cur) => 
        {
          console.log(cur.err); 
          if(cur.err !== null) {
            res.err.push(cur.queryId);
          } else {
            res.success.push(cur.queryId);
          }
          return res;
        }, {success: [], err: []});
    } catch(err) {
      console.log(err);
      return;
    }
  }

  console.log(logSending);
  console.log('deleted from base', await flushResponded(logSending.success, eventEmitter));
}