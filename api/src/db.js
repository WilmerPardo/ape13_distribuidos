const mysql = require('mysql2/promise');

// Arquitectura de Conexión: PoolCluster (Balanceo de Carga y CQRS)
// Esto permite enrutar automáticamente las escrituras al Maestro y las lecturas a las Réplicas
const cluster = mysql.createPoolCluster({
  canRetry: true,
  removeNodeErrorCount: 1, // Si un nodo falla (ej. Master en Failover), lo ignora temporalmente
  restoreNodeTimeout: 10000
});

// Nodo Maestro (Escrituras)
cluster.add('MASTER', {
  host: 'maestro', // Nombre del contenedor docker
  user: 'root',
  password: 'rootpassword',
  database: 'lab_test',
  port: 3306
});

// Nodo Réplica 1 (Lecturas)
cluster.add('REPLICA1', {
  host: 'la_nueva',
  user: 'root',
  password: 'rootpassword',
  database: 'lab_test',
  port: 3306
});

// Nodo Réplica 2 (Lecturas)
cluster.add('REPLICA2', {
  host: 'la_ex',
  user: 'root',
  password: 'rootpassword',
  database: 'lab_test',
  port: 3306
});

module.exports = cluster;
