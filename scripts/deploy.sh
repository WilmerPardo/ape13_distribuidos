#!/bin/bash
set -e

echo "=== Desplegando Contenedores ==="
cd "$(dirname "$0")/../lab_replica"
docker-compose down -v
docker-compose up -d

echo "Esperando 15 segundos a que MariaDB inicialice..."
sleep 15

echo "=== Configurando Maestro ==="
docker exec maestro mariadb -uroot -prootpassword -e "GRANT REPLICATION SLAVE ON *.* TO 'replica_user'@'%' IDENTIFIED BY 'replica_password'; FLUSH PRIVILEGES;"

MASTER_STATUS=$(docker exec maestro mariadb -uroot -prootpassword -e "SHOW MASTER STATUS\G")
FILE=$(echo "$MASTER_STATUS" | grep "File:" | awk '{print $2}')
POS=$(echo "$MASTER_STATUS" | grep "Position:" | awk '{print $2}')

echo "Log File del Maestro: $FILE"
echo "Posición del Log: $POS"

echo "=== Configurando Réplica 1 ==="
docker exec la_nueva mariadb -uroot -prootpassword -e "CHANGE MASTER TO MASTER_HOST='maestro', MASTER_USER='replica_user', MASTER_PASSWORD='replica_password', MASTER_LOG_FILE='$FILE', MASTER_LOG_POS=$POS; START SLAVE;"

echo "=== Configurando Réplica 2 ==="
docker exec la_ex mariadb -uroot -prootpassword -e "CHANGE MASTER TO MASTER_HOST='maestro', MASTER_USER='replica_user', MASTER_PASSWORD='replica_password', MASTER_LOG_FILE='$FILE', MASTER_LOG_POS=$POS; START SLAVE;"

echo "=== Creando Base de Datos lab_test ==="
docker exec maestro mariadb -uroot -prootpassword -e "CREATE DATABASE IF NOT EXISTS lab_test; USE lab_test; CREATE TABLE IF NOT EXISTS items (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50));"

echo "¡Despliegue automático completado y API escuchando en el puerto 3000!"
