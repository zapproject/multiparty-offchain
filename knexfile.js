module.exports = {
  development: {
    client: 'mysql',
    connection: {
      host : 'database-2.cgps2bpd2nat.eu-west-1.rds.amazonaws.com',
      user : 'admin',
      password : 'modqBT11',
      database : ''
    },
    migrations: {
      directory: __dirname + '/db/migrations',
      loadExtensions: ['.js'],
    }
  }
}