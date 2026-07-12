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
- **Body:** Selecciona `raw` y `JSON`. Pega lo siguiente:
  ```json
  {
      "name": "Probando desde Postman"
  }
  ```
- **Send:** Debería devolver `201 Created` con una respuesta similar a:
  ```json
  {
      "message": "Dato guardado correctamente (Command)",
      "data": {
          "servedBy": "maestro",
          "name": "Probando desde Postman"
      }
  }
  ```
  *(Nota que el campo `servedBy` te indicará explícitamente que la escritura fue procesada por el nodo maestro).*

**2. Para consultar los datos (Lectura -> se lee de la_nueva o la_ex):**
- **Método:** `GET`
- **URL:** `http://localhost:3000/api/items`
- **Send:** Debería devolver `200 OK` con todos los registros. Si envías la petición varias veces seguidas, verás cómo el campo `servedBy` va alternando entre `la_nueva` y `la_ex`, demostrando visualmente el balanceo de carga:
  ```json
  {
      "message": "Datos leídos (Query)",
      "data": {
          "servedBy": "la_nueva",
          "items": [
              {
                  "id": 1,
                  "name": "Probando desde Postman"
              }
          ]
      }
  }
  ```

- **Prueba rápida del Balanceo de Carga:** También puedes verificar este comportamiento (Round-Robin) ejecutando tres peticiones rápidas seguidas desde tu terminal:
  ```bash
  curl -s http://localhost:3000/api/items | grep servedBy && curl -s http://localhost:3000/api/items | grep servedBy && curl -s http://localhost:3000/api/items | grep servedBy
  ```

### Opción B: Pruebas rápidas por Terminal (cURL)

**Para insertar un dato:**
```bash
curl -X POST http://localhost:3000/api/items \
     -H "Content-Type: application/json" \
     -d '{"name": "Dato de Prueba 1"}'
```

**Para consultar los datos en formato JSON crudo:**
```bash
curl http://localhost:3000/api/items
```

**Para consultar los datos en formato de Tabla (más legible):**
Si tienes instalada la utilidad `jq` (muy común en Linux), puedes usar este comando para transformar la respuesta JSON de la API en una tabla limpia que te muestra el ID, el Nombre, y qué nodo respondió a la consulta:
```bash
curl -s http://localhost:3000/api/items | jq -r '["SERVED BY", "ID", "NAME"], ["---------", "--", "-------------------"], (.data | .servedBy as $node | .items[] | [$node, .id, .name]) | @tsv' | column -t -s $'\t'
```

---

## 3. Pruebas de Consistencia y Restricciones de Replicación

Antes de probar las fallas, validaremos que la replicación fluye en paralelo y que las réplicas rechazan escrituras de manera efectiva.

**A. Verificación de Tráfico en Paralelo y Consistencia:**
Inserta un dato en el maestro desde la terminal:
```bash
docker exec maestro mariadb -uroot -prootpassword -e "USE lab_test; INSERT INTO items (name) VALUES ('Prueba de Consistencia Directa');"
```
Verifica que el dato se haya propagado a ambas réplicas en paralelo:
```bash
docker exec la_nueva mariadb -uroot -prootpassword -e "USE lab_test; SELECT * FROM items;"
docker exec la_ex mariadb -uroot -prootpassword -e "USE lab_test; SELECT * FROM items;"
```

**B. Verificación de Restricción de Solo Lectura (`read_only`):**
Para probar que las réplicas rechazan escrituras, crearemos un usuario de aplicación estándar, ya que el usuario `root` en MariaDB (al tener permisos `SUPER`) ignora por diseño la restricción `read_only`.

Crea el usuario en el Maestro:
```bash
docker exec maestro mariadb -uroot -prootpassword -e "CREATE USER 'app_user'@'%' IDENTIFIED BY '1234'; GRANT ALL PRIVILEGES ON lab_test.* TO 'app_user'@'%'; FLUSH PRIVILEGES;"
```

Intenta insertar un dato en la Réplica 1 usando este usuario normal:
```bash
docker exec la_nueva mariadb -uapp_user -p1234 -e "USE lab_test; INSERT INTO items (name) VALUES ('Esto fallara');"
```
Deberás obtener un error explícito `ERROR 1290 (HY000)` indicando que el servidor se encuentra con la opción `--read-only` activada, demostrando que cumplen su rol de solo lectura.

---

## 4. Prueba de Tolerancia a Fallos (Failover Manual)

Para comprobar la resiliencia del clúster frente a caídas, realizaremos un procedimiento manual de desastre y recuperación.

**Paso 1: Simular la caída del Maestro**
Detén el contenedor principal:
```bash
docker stop maestro
```

**Paso 2: Promover la Réplica 1 a Nuevo Maestro**
Desvincula la réplica, borra su metadata de esclavo y deshabilita el modo de *solo lectura* para que acepte escrituras:
```bash
docker exec la_nueva mariadb -uroot -prootpassword -e "STOP SLAVE; RESET SLAVE ALL; SET GLOBAL read_only = 0;"
```

**Paso 3: Validar el Failover (Insertar en el Nuevo Maestro)**
Prueba a insertar un dato directamente en la Réplica 1 (`la_nueva`), la cual ahora actúa como maestro principal:
```bash
docker exec la_nueva mariadb -uroot -prootpassword -e "USE lab_test; INSERT INTO items (name) VALUES ('Dato post-failover manual');"
```

Verifica que el dato se haya insertado correctamente, lo que confirma que ahora asume el rol de Maestro:
```bash
docker exec la_nueva mariadb -uroot -prootpassword -e "USE lab_test; SELECT * FROM items;"
```

---

## 5. Parada y Limpieza del Sistema

Si deseas detener los contenedores y destruir por completo la información, los logs y las tablas, debes borrar los volúmenes de Docker ubicándote en la carpeta `lab_replica`:

```bash
cd lab_replica
docker-compose down -v
```
