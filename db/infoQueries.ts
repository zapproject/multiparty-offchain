import knex from './knex';

export enum QueryStatus {
  Scheduled,
  Running,
  Completed,
};

export function getInfo({id, addr}) {
  return knex('queries')
    .select('*')
    .where('id', '>', id)
    .orderBy('id', 'desc')
    .then(async queries => {
       const idsList = queries.map(item => item.queryId);
        return Promise.all([
            knex('responses')
            .select('*')
            //.whereIn('queryId', idsList),
            .where('addr', addr),
            Promise.resolve(queries)
        ])
    })
    .then(res => {
        return Promise.all([
            knex('queries').count({count: '*'}),
            ...res])
    })
}

