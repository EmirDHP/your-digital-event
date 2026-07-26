# Generación y validación estática de eventos

## Requisito

Node.js 18.18.0 o superior. El proyecto no requiere instalar paquetes npm:
todos los scripts utilizan únicamente módulos incluidos con Node.js.

Node se utiliza solo durante la generación local o en CI. El resultado
publicable es completamente estático y no requiere Node, npm ni un servidor de
aplicaciones en producción.

## Comandos

Generar todos los eventos canónicos:

```powershell
npm run build
```

Comprobar las configuraciones fuente y la salida que ya existe en `dist/`:

```powershell
npm run check
```

Construir y comprobar en un solo comando antes de publicar:

```powershell
npm run validate
```

`npm run check` falla con un código de salida distinto de cero cuando encuentra
una configuración inválida, un evento faltante, un tema incompleto, una ruta
insegura o un recurso local inexistente.

El alias histórico `npm run build:events` se conserva temporalmente y ejecuta
el mismo generador que `npm run build`.

No se incluye un comando `clean`: el generador crea la nueva salida en un
directorio temporal y reemplaza `dist/` solamente después de completar el
build. Borrar manualmente la salida no es necesario para obtener un resultado
limpio.

## Flujo para crear o actualizar un evento

1. Crear o editar `events/<slug>/config.json`.
2. Guardar los recursos propios del cliente dentro de
   `events/<slug>/assets/`.
3. Mantener el slug de la configuración igual al nombre de la carpeta.
4. Referenciar un tema existente en `src/invitation/themes/<theme>/`.
5. No copiar `index.html`, CSS del tema ni runtime dentro del evento.
6. Ejecutar:

   ```powershell
   npm run validate
   ```

7. Corregir cualquier error indicando evento, archivo y problema.
8. Publicar únicamente el contenido resultante de `dist/`.

La estructura fuente esperada es:

```text
events/
  <slug>/
    config.json
    assets/
```

La salida publicable es:

```text
dist/
  shared/
    invitation/
      runtime/
      themes/
  events/
    <slug>/
      index.html
      assets/
```

## Qué verifica `npm run check`

- existencia de `dist/`;
- correspondencia entre eventos canónicos y eventos generados;
- presencia de `index.html` en cada evento;
- validez de las configuraciones canónicas e incrustadas;
- coincidencia entre la configuración incrustada y su fuente;
- slugs duplicados o inconsistentes;
- manifest y CSS de cada tema utilizado;
- assets referenciados por configuración;
- rutas locales de HTML y CSS;
- grafo de imports del runtime JavaScript;
- rutas locales absolutas, protocolos inseguros y traversal fuera de `dist/`;
- presencia del CSS y JavaScript compartidos;
- ausencia de referencias a `config.json` en el HTML generado.

Las rutas relativas que suben desde `dist/events/<slug>/` hacia
`dist/shared/` son válidas porque permanecen dentro de `dist/`. Cualquier
traversal que salga de la raíz publicable se considera un error.

## Build selectivo para diagnóstico

El generador conserva la opción de generar un único evento:

```powershell
node scripts/build-events.mjs --event sofia-y-carlos
```

Esta opción sigue reemplazando `dist/` con la selección solicitada. Para una
validación publicable completa utiliza siempre `npm run validate`.

## Rollback del piloto

La implementación anterior del evento piloto sigue respaldada en:

```text
.migration-backups/sofia-y-carlos-before-generator/
```

Ese respaldo no forma parte del build ni de la salida publicable.
