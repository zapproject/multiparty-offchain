import * as Knex from 'knex';

export const up = function(knex: Knex, Promise) {
  return knex.schema.createTable('queries', table => {
    table.increments('id').primary();
    table.string('queryId', 255).notNullable();
    table.string('mpoId', 255).notNullable();
    table.text('query').notNullable();
    table.decimal('threshold').notNullable();
    table.string('endpoint', 255).notNullable();
    table.string('subscriber', 255).notNullable();
    table.string('provider', 255).notNullable();
    table.text('endpointParams').notNullable();
    table.string('onchainSubscriber', 255).notNullable();
    table.timestamp('received').defaultTo(knex.fn.now());
    table.unique(['mpoId'], 'unique_query');
  }).createTable('responses', table => {
    table.increments('id').primary();
    table.string('queryId', 255).notNullable();
    table.string('mpoId', 255).notNullable();
    table.text('hash').notNullable();
    table.string('sigv', 255).notNullable();
    table.string('sigrs', 255).notNullable();
    table.string('addr', 255).notNullable();
    table.string('status', 255);
    table.text('response').notNullable();
    table.unique(['mpoId'], 'unique_response');
  });
};

export const down = function(knex, Promise) {
  return knex.schema.dropTable('queries').dropTable('responses');
};
