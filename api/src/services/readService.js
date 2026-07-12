const cluster = require('../config/db');

// (Query) Lógica para obtener datos (Usa REPLICAS)
async function getItems() {
  const replicaPool = cluster.of('REPLICA*');
  const connection = await replicaPool.getConnection();
  try {
    const [serverInfo] = await connection.query('SELECT @@hostname as serverName');
    const [rows] = await connection.query('SELECT * FROM items');
    return {
      servedBy: serverInfo[0].serverName,
      items: rows
    };
  } finally {
    connection.release();
  }
}

module.exports = {
  getItems
};
