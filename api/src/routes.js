const express = require('express');
const router = express.Router();
const cluster = require('./db');

// POST /items (Escritura -> Fuerza a usar el MASTER)
router.post('/items', async (req, res) => {
  const { id, name } = req.body;
  try {
    const masterPool = cluster.of('MASTER');
    await masterPool.query('INSERT INTO items (id, name) VALUES (?, ?)', [id, name]);
    res.status(201).json({ message: 'Dato guardado correctamente en el Maestro', data: { id, name } });
  } catch (error) {
    console.error('Error escribiendo en el maestro:', error);
    res.status(500).json({ error: 'Fallo al escribir en la base de datos' });
  }
});

// GET /items (Lectura -> Distribuye balanceado entre REPLICA1 y REPLICA2)
router.get('/items', async (req, res) => {
  try {
    // 'REPLICA*' matchea cualquier nodo que empiece con REPLICA (Replica1, Replica2)
    const replicaPool = cluster.of('REPLICA*');
    const [rows] = await replicaPool.query('SELECT * FROM items');
    res.status(200).json({ message: 'Datos leídos desde una Réplica', data: rows });
  } catch (error) {
    console.error('Error leyendo de la réplica:', error);
    res.status(500).json({ error: 'Fallo al leer de la base de datos' });
  }
});

module.exports = router;
