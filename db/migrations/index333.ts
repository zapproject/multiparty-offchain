import * as Knex from 'knex';

export const up = function(knex: Knex, Promise) {
    return knex.schema.dropTable('queries').dropTable('responses');
}

export const down = function(knex, Promise) {
  return knex.schema.dropTable('queries').dropTable('responses');
};