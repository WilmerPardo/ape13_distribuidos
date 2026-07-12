const cluster = require('../config/db');

// (Command) Lógica para insertar datos (Usa MASTER)
async function createItem(id, name) {
  const masterPool = cluster.of('MASTER');
  const connection = await masterPool.getConnection();
  try {
    const [serverInfo] = await connection.query('SELECT @@hostname as serverName');
    await connection.query('INSERT INTO items (id, name) VALUES (?, ?)', [id, name]);
    return { servedBy: serverInfo[0].serverName, id, name };
  } finally {
    connection.release();
  }
}

module.exports = {
  createItem
};
