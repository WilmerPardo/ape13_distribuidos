#!/bin/bash
set -e

echo "=== Prueba de Failover ==="
echo "1. Deteniendo contenedor maestro (mdb-master)..."
cd ../lab_replica
docker stop mdb-master

echo "2. Promoviendo Réplica 1 a Maestro..."
docker exec mdb-replica1 mariadb -uroot -prootpassword -e "STOP SLAVE; RESET SLAVE ALL; SET GLOBAL read_only = 0;"

echo "3. Insertando dato directamente en la Réplica 1 (Nuevo Maestro)..."
docker exec mdb-replica1 mariadb -uroot -prootpassword -e "USE lab_test; INSERT INTO items (name) VALUES ('Dato post-failover');"

echo "4. Verificando datos en la Réplica 1..."
docker exec mdb-replica1 mariadb -uroot -prootpassword -e "USE lab_test; SELECT * FROM items;"

echo "¡Failover comprobado exitosamente!"
