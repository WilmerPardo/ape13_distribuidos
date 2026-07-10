const express = require('express');
const router = express.Router();
const itemController = require('../controllers/itemController');

// (Query) Obtener datos
router.get('/items', itemController.getItems);

// (Command) Crear un dato
router.post('/items', itemController.createItem);

module.exports = router;
