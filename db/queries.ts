import knex from './knex';
import { QueryEvent, ResponseEvent } from '../Oracle/types';
import mysql from 'mysql';
import cron from 'node-cron';

export enum QueryStatus {
  Scheduled,
  Running,
  Completed,
};

export function addQuery(event: QueryEvent): any {
  return knex('queries').insert({
    queryId: String(event.queryId),
    query: event.query,
    received: Date.now()
  }).returning('id');
}

export function addResponse(event: ResponseEvent): any {
  const {response, publicKey} = event;

  //if(id && signature) updtate
  return knex('response').insert({
    queryId: String(event.queryId),
    response,
    publicKey
  }).returning('id');
}

export function flushResponded(keys) {
  return Promise.all([
    knex('queries')
    .whereIn('queryId', keys)
    .andWhere('received', '<', Date.now() - 30000)
    .del(),
    knex('responses')
    .whereIn('queryId', keys)
    .andWhere('received', '<', Date.now() - 30000)
    .del()
  ]);
}

export function restoreNotResponded(keys) {
  return Promise.all([
    knex('responses')
    .whereIn('queryId', keys)
    .update('status', '')
  ]);
}

export function getResponses(count) {
  const subquery = knex.select('queryId')
    .from('responses')
    .whereNot('status', 'toDelete')
    .groupBy('queryId')
    .having(knex.raw(`count(*) >= ${count}`));
    knex.transaction(function(trx) {
      return trx.select('queryId')
      .from('responses')
      .whereNot('status', 'toDelete')
      .groupBy('queryId')
      .having(knex.raw(`count(*) >= ${count}`))
      .then(function(ids) {
        trx.select('*').from('responses')
        .whereIn('queryId', ids);
        return ids;
      })
      .then(function(ids) {
        return trx.whereIn('queryId', ids)
        .update('status', 'toDelete')
      })
    });
    
}

 export async function handleResponsesInDb(quantity, callContractRespond) {
  const responses = await getResponses(quantity);
  const queriesList = responses.reduce((obj, {publicKey, response, queryId}) => {
    return {...obj,  [queryId] : [...[queryId], {publicKey, response}]}
  }, {});

  try {
    await callContractRespond(responses);
    flushResponded(Object.keys(queriesList)).then(()=> console.log('flushed')).catch(err => console.log(err))
  } catch(err) {
    console.log(err);
    restoreNotResponded(Object.keys(queriesList)).then(()=> console.log('flushed')).catch(err => console.log(err))
  }
}