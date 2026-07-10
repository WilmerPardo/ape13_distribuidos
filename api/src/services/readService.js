const cluster = require('../config/db');

// (Query) Lógica para obtener datos (Usa REPLICAS)
async function getItems() {
  const replicaPool = cluster.of('REPLICA*');
  const [rows] = await replicaPool.query('SELECT * FROM items');
  return rows;
}

module.exports = {
  getItems
};
