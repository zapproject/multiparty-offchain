import knex from './knex';

export enum QueryStatus {
  Scheduled,
  Running,
  Completed,
};

export function getInfo({limit, offset}) {
  return knex('queries')
    .select('*')
    .limit(limit)
    .offset(offset)
    .then(async queries => {
       const idsList = queries.map(item => item.queryId);
       console.log(queries)
        return Promise.all([
            knex('responses')
            .select('*')
            .whereIn('queryId', idsList),
            Promise.resolve(queries)
        ])
    })
    .then(res => {
        return Promise.all([
            knex('queries').count({count: '*'}),
            ...res])
    })
}

