import knex from './knex';
import { QueryEvent, ResponseEvent } from '../Oracle/types';
import mysql from 'mysql';
import cron from 'node-cron';
import Config from "../Oracle/Config.js";


export enum QueryStatus {
  Scheduled,
  Running,
  Completed,
};

export function addQuery(event: QueryEvent): any {
 return knex('queries').insert({
    queryId: String(event.queryId),
    query: event.query,
    received: new Date()
  }).returning('id');
}

export async function addResponse(event: ResponseEvent): Promise<any> {
  const {response, hash, sigv, sigrs} = event;
  return await knex('responses').insert({
    queryId: String(event.queryId),
    response,
    hash,
    sigv,
    sigrs,
    status: 'Active'
  }).returning('id');
}

export function flushResponded(keys) {
  knex.select('*')
      .from('queries').then(res => console.log('queries:', res))
  return knex.transaction(function(trx) {
    let idsList;
    return trx.select('queryId')
    .from('queries')
    .where('received', '<', new Date(Date.now() - Config.timeout))
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
    });
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

 export async function handleResponsesInDb(quantity, callContractRespond) {
  const responses = await getResponses(quantity);
  const queriesList = responses.reduce((obj, {hash, sigv, sigrs, response, queryId}) => {
    if(!obj[queryId]) obj[queryId] = {hash: [], sigv: [], sigrs: [], response: []};
    return {...obj, [queryId]: {
      hash: [...obj[queryId]['hash'], hash],
      sigv: [...obj[queryId]['sigv'], sigv],
      sigrs: [...obj[queryId]['sigrs'], sigrs],
      response: [...obj[queryId]['response'], response]
    }}}, {});

  try {
    await callContractRespond(queriesList);
    flushResponded(Object.keys(queriesList)).then(()=> console.log('flushed')).catch(err => console.log(err))
  } catch(err) {
    console.log(err);
    restoreNotResponded(Object.keys(queriesList)).then(()=> console.log('flushed')).catch(err => console.log(err))
  }
}