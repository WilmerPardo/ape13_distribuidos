# Guía de Ejecución: Clúster MariaDB (Replicación y Failover)

Esta guía detalla los pasos para ejecutar la práctica de despliegue de un clúster MariaDB con replicación lógica (Binlog), junto con una API REST en Node.js que implementa una arquitectura por capas y el patrón **CQRS**. Todo el despliegue, configuración y pruebas han sido automatizados mediante scripts para facilitar su ejecución.

---

## 1. Despliegue Automatizado

El script de despliegue se encarga automáticamente de:
1. Limpiar y eliminar cualquier entorno previo.
2. Levantar el clúster con Docker Compose (`maestro`, `la_nueva`, `la_ex` y la `API REST`).
3. Crear el usuario de replicación, extraer las posiciones de los *logs* y vincular las réplicas al maestro.
4. Crear la base de datos de prueba.

Para ejecutar el despliegue, abre una terminal en la raíz del proyecto y corre:

```bash
./scripts/deploy.sh
```
> *Nota: El script hará pausas automáticas para permitir que las bases de datos de MariaDB se inicialicen internamente de forma correcta.*

---

## 2. Pruebas a la API REST (CQRS)

Una vez que el script finaliza, la API estará escuchando peticiones en el puerto `3000`. Gracias a la arquitectura implementada, las peticiones **POST** enrutan automáticamente al `maestro` y las peticiones **GET** se balancean entre las réplicas.

### Opción A: Pruebas con Postman (Recomendado)

**1. Para insertar un dato (Escritura -> viaja al Maestro):**
- **Método:** `POST`
- **URL:** `http://localhost:3000/api/items`
- **Body:** Selecciona `raw` y cambia a `JSON`. Pega lo siguiente:
  ```json
  {
      "name": "Probando desde Postman"
  }
  ```
- **Send:** Debería devolver `201 Created`.

**2. Para consultar los datos (Lectura -> se lee de la_nueva o la_ex):**
- **Método:** `GET`
- **URL:** `http://localhost:3000/api/items`
- **Send:** Debería devolver `200 OK` con todos los registros actuales.

### Opción B: Pruebas rápidas por Terminal (cURL)

**Para insertar un dato:**
```bash
curl -X POST http://localhost:3000/api/items \
     -H "Content-Type: application/json" \
     -d '{"name": "Dato de Prueba 1"}'
```

**Para consultar los datos:**
```bash
curl http://localhost:3000/api/items
```

---

## 3. Prueba de Tolerancia a Fallos (Failover Automatizado)

Para comprobar la resiliencia del clúster frente a caídas, hemos creado un segundo script que realiza la simulación de un escenario de desastre y recuperación:
1. Simula una caída deteniendo el contenedor del maestro (`maestro`).
2. Entra a la Réplica 1 (`la_nueva`), borra la metadata de esclavo y deshabilita su modo de *solo lectura* para promoverlo.
3. Inserta exitosamente un nuevo registro confirmando que ahora ejerce como Maestro.

Para ejecutar la prueba de failover, simplemente corre:

```bash
./scripts/test_failover.sh
```

---

## 4. Parada y Limpieza del Sistema

Si deseas detener los contenedores y destruir por completo la información, los logs y las tablas, debes borrar los volúmenes de Docker ubicándote en la carpeta `lab_replica`:

```bash
cd lab_replica
docker-compose down -v
```
