const express = require('express');
const itemRoutes = require('./routes/itemRoutes');

const app = express();
app.use(express.json());

// Montar las rutas
app.use('/api', itemRoutes);

// Ruta de healthcheck
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'API is running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API REST escuchando en http://localhost:${PORT}`);
});
