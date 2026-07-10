const writeService = require('../services/writeService');
const readService = require('../services/readService');

async function getItems(req, res) {
  try {
    const items = await readService.getItems();
    res.status(200).json({
      message: 'Datos leídos (Query)',
      data: items
    });
  } catch (error) {
    console.error('Error en getItems:', error);
    res.status(500).json({ error: 'Fallo al obtener los datos de lectura' });
  }
}

async function createItem(req, res) {
  const { id, name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'El campo "name" es requerido' });
  }

  try {
    const newItem = await writeService.createItem(id, name);
    res.status(201).json({
      message: 'Dato guardado correctamente (Command)',
      data: newItem
    });
  } catch (error) {
    console.error('Error en createItem:', error);
    res.status(500).json({ error: 'Fallo al escribir el nuevo dato' });
  }
}

module.exports = {
  getItems,
  createItem
};
