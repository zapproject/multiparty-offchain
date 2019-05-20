module.exports = {
  development: {
    client: 'mysql',
    connection: {
      host : '127.0.0.1',
      user : 'root',
      password : '1',
      database : 'oracle'
    },
    migrations: {
      directory: __dirname + '/db/migrations',
      loadExtensions: ['.js'],
    }
  }
}