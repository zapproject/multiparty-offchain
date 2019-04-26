import knex from './knex';
import { QueryEvent } from '../Oracle/types';
import mysql from 'mysql';

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

  //if(id && signature) updtate
  return knex('response').insert({
    queryId: String(event.queryId),
    response: response,
    signature: signature
  }).returning('id');
}

export function flushResponded(keys) {
  return Promise.all([
    knex('queries')
    .whereIn('queryId', keys)
    .del(),
    knex('responses')
    .whereIn('queryId', keys)
    .del()
  ]);
}

export function getResponses(count) {
  const subquery = knex.select('queryId')
    .from('responses')
    .groupBy('queryId')
    .having(knex.raw(`count(*) >= ${count}`))
    .union(function() {
      this.select('*').from('queries').where('received', '<', Date.now() - 30000)
    })
    return knex.select('*').from('responses')
      .whereIn('queryId', subquery)
}

 async function crontab() {
   //get whitelist. quantity = 12
   const respones = await getResponses(12);
   const queriesList = [];
   respones.forEach(item => {
     if (!queriesList[item.queryId]) queriesList[item.queryId] = [];
     queriesList[item.queryId].push({sign: item.signature, response: item.response})
   });
   for (let key in queriesList){
     //gather format for contract
     //push in promise
   }
   //promiseAll the
   flushResponded(Object.keys(respones)).then(()=> console.log('flushed').catch(err => console.log(err))
 }
 setInterval(crontab, 15000);

export function getQueriesToRun(timestamp) {
  return knex('queries').where('query_time', '<', new Date(timestamp)).andWhere('status', QueryStatus.Scheduled).select('queryId', 'sql');
}

export async function getQueryData(queryId, sql) {
  return knex('queries').where('queryId', queryId).update('status', QueryStatus.Running)
    .then(() => knex.raw(sql.replace('primary', '`primary`')));
}

export function completeQuery(queryId, message = null) {
  return knex('queries').where('queryId', queryId).update({
    status: QueryStatus.Completed,
    query_executed: new Date(),
    message,
  });
}

export function queryError(queryId, message = null) {
  return knex('queries').where('queryId', queryId).update({
    query_executed: new Date(),
    message,
  });
}

/*
const http = require('http');
const { parse } = require('querystring');
export function handleResponses(err, cb) {
const server = http.createServer((req, res) => {
    if (req.method === 'POST' && req.url === "/response") {
    let body = '';
    req.on('data', chunk => {
        body += chunk.toString(); // convert Buffer to string
    });
    req.on('end', () => {
        cb(parse(body));
        res.end('ok');
    });
}
   
});
server.listen(3000);
}
*/

handleResponses(addResponse)