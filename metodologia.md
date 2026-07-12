# Metodología y Desarrollo de la Práctica: Clúster MariaDB y CQRS

El desarrollo de esta práctica de sistemas distribuidos se estructuró de manera progresiva, abarcando desde la definición de la infraestructura hasta la validación de la resiliencia del sistema. El proceso se dividió en cuatro fases clave:

## Fase 1: Diseño de Infraestructura y Configuración de Contenedores
En esta etapa inicial, el enfoque fue preparar el entorno virtualizado y aislar los servicios necesarios:
*   **Definición de Arquitectura en Docker Compose:** Se construyó el archivo `docker-compose.yml` para orquestar 4 servicios: 1 nodo Maestro (`maestro`), 2 nodos Réplica (`la_nueva`, `la_ex`) usando la imagen oficial de MariaDB 10.11, y 1 contenedor Node.js para la API REST. Todos operan dentro de una red Bridge compartida (`db_network`), asegurando comunicación interna por nombres de host.
*   **Archivos de Configuración (`.cnf`):** Se crearon configuraciones dedicadas montadas como volúmenes. Al Maestro se le asignó el `server-id=1` y se le habilitó el `log_bin` (Binary Log) indispensable para la replicación lógica. A las réplicas se les asignaron identificadores únicos (`server-id=2` y `3`) y se les impuso la restricción estricta `read_only = 1`, garantizando que actúen exclusivamente como bases de datos en estado "standby" para operaciones de lectura.

## Fase 2: Orquestación y Sincronización de Réplicas
El objetivo de esta fase fue establecer la topología de replicación (1 Maestro -> 2 Réplicas) y automatizar el flujo de los binlogs.
*   **Automatización del Despliegue:** Se desarrolló el script Bash `deploy.sh` que levanta la infraestructura, espera a que el motor MariaDB inicialice y ejecuta comandos SQL de configuración.
*   **Creación del Enlace de Replicación:** En el Maestro se creó un usuario con privilegios `REPLICATION SLAVE`. Luego, el script extrae de forma dinámica el nombre del archivo de registro (`File`) y el punto exacto de lectura (`Position`) usando el comando `SHOW MASTER STATUS`.
*   **Streaming de Logs:** Las réplicas utilizan esos parámetros dinámicos a través de la instrucción `CHANGE MASTER TO...`, lo que inicia el tráfico de logs en paralelo, permitiendo que `la_nueva` y `la_ex` escuchen y apliquen de forma asíncrona todos los cambios realizados en el maestro.

## Fase 3: Implementación del Patrón CQRS y Tolerancia a Fallos
Con la base de datos distribuida lista, se procedió a conectar la capa de aplicación y preparar el sistema para eventuales caídas.
*   **API REST y Enrutamiento (CQRS):** Se programó una API en Node.js que implementa un `PoolCluster` utilizando el módulo `mysql2`. Se configuró la separación de responsabilidades: las operaciones de escritura/mutación (POST) se envían de forma exclusiva al nodo Maestro, mientras que las operaciones de consulta (GET) se balancean automáticamente hacia las réplicas usando un algoritmo *Round-Robin*.
*   **Protocolo de Desastre (Failover):** Se estableció un procedimiento de recuperación manual para simular la caída del Maestro. Esto implica detener el contenedor del Maestro y promover una de las réplicas (`la_nueva`) ejecutando comandos para borrar su metadata de esclavo (`STOP SLAVE; RESET SLAVE ALL;`) y deshabilitando su modo de solo lectura (`SET GLOBAL read_only = 0;`), convirtiéndola así en el nuevo Nodo Principal para garantizar la Alta Disponibilidad.

## Fase 4: Verificación y Pruebas del Sistema (Terminal y Postman)
La etapa final consistió en someter el sistema a pruebas de estrés y validación funcional.
*   **Validación de Consistencia y Restricciones:** Se realizaron inserciones directas a través de la terminal (CLI de Docker) para comprobar que el dato se propagaba de inmediato a todos los nodos (consistencia eventual). Además, creando un usuario de aplicación estándar, se corroboró que las réplicas arrojan errores (`ERROR 1290`) al intentar escribir sobre ellas, demostrando la eficacia del bloqueo `read_only`.
*   **Pruebas de Balanceo de Carga en API:** A través de **Postman** y **cURL**, se enviaron peticiones a la API REST. Gracias a una modificación en el código (que incluye la metadata `servedBy` en cada respuesta JSON), se logró verificar visualmente que las escrituras siempre son atendidas por el `maestro`, y que las lecturas van alternándose de forma equitativa entre `la_nueva` y `la_ex`. Finalmente, se integró la herramienta `jq` para formatear estas salidas en tablas legibles ASCII desde la terminal.
