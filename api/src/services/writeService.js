const cluster = require('../config/db');

// (Command) Lógica para insertar datos (Usa MASTER)
async function createItem(id, name) {
  const masterPool = cluster.of('MASTER');
  await masterPool.query('INSERT INTO items (id, name) VALUES (?, ?)', [id, name]);
  return { id, name };
}

module.exports = {
  createItem
};
