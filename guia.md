# Guía de Ejecución: Clúster MariaDB (Replicación y Failover)

Esta guía detalla los comandos exactos para ejecutar la práctica de despliegue de un clúster MariaDB con replicación lógica (Binlog) y probar su tolerancia a fallos, basada en la estructura del directorio `lab_replica`.

## Fase 2: Despliegue del Clúster MariaDB y Replicación

### 1. Iniciar los contenedores
Asegúrate de estar dentro del directorio `lab_replica` donde se encuentra el archivo `docker-compose.yml`.
```bash
cd lab_replica
docker-compose up -d
```
> *Nota: Espera unos 10-15 segundos antes de continuar para permitir que el motor de MariaDB se inicialice correctamente.*

### 2. Configurar el Maestro
Crea el usuario de replicación y verifica la posición actual del log binario en el Maestro.
```bash
docker exec mdb-master mariadb -uroot -prootpassword -e "GRANT REPLICATION SLAVE ON *.* TO 'replica_user'@'%' IDENTIFIED BY 'replica_password'; FLUSH PRIVILEGES; SHOW MASTER STATUS;"
```
Anota los valores que aparezcan bajo las columnas **File** (ej. `mysql-bin.000002`) y **Position** (ej. `669`).

### 3. Configurar las Réplicas
Utiliza los valores de File y Position obtenidos en el paso anterior y reemplázalos en los siguientes comandos.

**Para la Réplica 1:**
```bash
docker exec mdb-replica1 mariadb -uroot -prootpassword -e "CHANGE MASTER TO MASTER_HOST='mdb-master', MASTER_USER='replica_user', MASTER_PASSWORD='replica_password', MASTER_LOG_FILE='mysql-bin.000002', MASTER_LOG_POS=669; START SLAVE; SHOW SLAVE STATUS\G"
```

**Para la Réplica 2:**
```bash
docker exec mdb-replica2 mariadb -uroot -prootpassword -e "CHANGE MASTER TO MASTER_HOST='mdb-master', MASTER_USER='replica_user', MASTER_PASSWORD='replica_password', MASTER_LOG_FILE='mysql-bin.000002', MASTER_LOG_POS=669; START SLAVE; SHOW SLAVE STATUS\G"
```
> *Asegúrate de que en la salida de ambos comandos aparezcan las líneas: `Slave_IO_Running: Yes` y `Slave_SQL_Running: Yes`.*

### 4. Validar Consistencia Eventual
Genera datos en el maestro:
```bash
docker exec mdb-master mariadb -uroot -prootpassword -e "CREATE DATABASE lab_test; USE lab_test; CREATE TABLE items (id INT, name VARCHAR(50)); INSERT INTO items VALUES (1, 'Dato Maestro');"
```

Verifica que el dato existe en las réplicas:
```bash
docker exec mdb-replica1 mariadb -uroot -prootpassword -e "USE lab_test; SELECT * FROM items;"
docker exec mdb-replica2 mariadb -uroot -prootpassword -e "USE lab_test; SELECT * FROM items;"
```

---

## Fase 3: Tolerancia a Fallos (Failover)

### 1. Detener el Maestro original
Simularemos que el servidor maestro ha sufrido una caída:
```bash
docker stop mdb-master
```

### 2. Promover la Réplica 1 a Maestro
Detenemos el proceso esclavo, limpiamos la metadata de replicación y desactivamos el modo de solo lectura para habilitar escrituras:
```bash
docker exec mdb-replica1 mariadb -uroot -prootpassword -e "STOP SLAVE; RESET SLAVE ALL; SET GLOBAL read_only = 0;"
```

### 3. Validar nuevo Maestro (Escritura en Réplica 1)
Insertamos un nuevo registro para comprobar que ahora la Réplica 1 acepta operaciones de escritura:
```bash
docker exec mdb-replica1 mariadb -uroot -prootpassword -e "USE lab_test; INSERT INTO items VALUES (2, 'Dato Failover en Replica 1'); SELECT * FROM items;"
```

---

## Parada y Limpieza del Sistema

Una vez finalizadas las pruebas, puedes apagar los contenedores y eliminar todo (redes y volúmenes generados) para dejar el entorno limpio:
```bash
# Estando dentro de lab_replica
docker-compose down -v
```
