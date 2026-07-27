# Generación y validación estática de eventos

## Requisito

Node.js 18.18.0 o superior. El proyecto no requiere instalar paquetes npm:
todos los scripts utilizan únicamente módulos incluidos con Node.js.

Node se utiliza solo durante la generación local o en CI. El resultado
publicable es completamente estático y no requiere Node, npm ni un servidor de
aplicaciones en producción.

## Comandos

Generar únicamente la salida intermedia de eventos (`dist/`):

```powershell
npm run build:events
```

Comprobar las configuraciones fuente y la salida que ya existe en `dist/`:

```powershell
npm run check
```

Construir y comprobar los eventos antes de ensamblar el sitio:

```powershell
npm run validate
```

Ensamblar el artefacto completo que se publica en GitHub Pages:

```powershell
npm run build
```

`npm run build` ejecuta el generador oficial de eventos y después construye
`site-dist/`. También puede invocarse explícitamente como
`npm run build:site`.

`npm run check` falla con un código de salida distinto de cero cuando encuentra
una configuración inválida, un evento faltante, un tema incompleto, una ruta
insegura o un recurso local inexistente. También ejecuta pruebas sin
dependencias que mantienen sincronizados el JSON Schema y el validador de
runtime para `event.subtype` y `sections.people`.

`npm run build:events` conserva el acceso directo al generador de invitaciones.
`npm run validate` vuelve a generar `dist/` antes de comprobar contratos,
configuraciones y rutas.

No se incluye un comando `clean`: ambos generadores crean la nueva salida en
directorios temporales y reemplazan `dist/` o `site-dist/` solamente después
de completar sus validaciones. Borrar manualmente las salidas no es necesario.

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
8. Ejecutar `npm run build`.
9. Publicar únicamente el contenido resultante de `site-dist/`.

### Tipos y subtipos de evento

Los tipos principales continúan siendo:

- `wedding`;
- `xv`;
- `event`.

Las celebraciones familiares no crean nuevos tipos principales. Utilizan
`event.type: "event"` y pueden declarar opcionalmente `event.subtype` con uno
de estos valores:

- `baptism`;
- `babyShower`;
- `presentation`;
- `firstBirthday`;
- `communion`;
- `kidsParty`;
- `familyCelebration`;
- `other`.

Ejemplo para un bautizo:

```json
{
  "event": {
    "type": "event",
    "subtype": "baptism"
  }
}
```

### Sección opcional de personas

`sections.people` representa grupos de personas importantes sin acoplar el
runtime a una celebración concreta:

```json
{
  "people": {
    "enabled": true,
    "title": "Con la bendición de",
    "intro": "Nos acompañan en este momento tan especial",
    "groups": [
      {
        "label": "Mis padres",
        "people": [
          {
            "name": "Nombre completo",
            "relation": "Mamá"
          }
        ]
      }
    ]
  }
}
```

`relation` e `image` son opcionales. Las imágenes deben ser rutas relativas
seguras dentro de los assets del evento. Cuando la sección no se utiliza puede
omitirse por completo; también puede declararse como:

```json
{
  "people": {
    "enabled": false
  }
}
```

El generador solo incluye la sección y su enlace de navegación cuando
`enabled` es `true` y la configuración es válida.

La estructura fuente esperada es:

```text
events/
  <slug>/
    config.json
    assets/
```

La salida intermedia de eventos es:

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

La salida publicable completa es:

```text
site-dist/
  index.html
  bodas.html
  xv.html
  eventos.html
  catalog.json
  assets/
  templates/
  shared/
    invitation/
  events/
    <slug>/
  .nojekyll
  CNAME
```

`site-dist/` es el único directorio que debe subirse como artefacto de GitHub
Pages. No incluye `events/` como fuente, `src/`, schemas, scripts, respaldos,
staging ni archivos de desarrollo.

Las demos históricas que importan el runtime desde `src/invitation/` se copian
sin duplicar el runtime: durante el ensamblado, sus referencias se dirigen en
la copia publicable hacia `site-dist/shared/invitation/`. Los archivos fuente
de las demos permanecen intactos en el repositorio.

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

## Publicación en GitHub Pages

El workflow `.github/workflows/deploy-pages.yml` se ejecuta con cada push a
`main` y también permite ejecución manual. Usa Node únicamente para validar y
generar el sitio; no ejecuta `npm install` ni publica el repositorio completo.

La secuencia de CI es:

1. `npm run validate`;
2. `npm run build`;
3. subir solamente `site-dist/`;
4. desplegar el artefacto mediante GitHub Pages.

El archivo `CNAME` se copia sin modificar y `.nojekyll` se crea durante el
build. Para probar localmente, sirve `site-dist/` como raíz con cualquier
servidor HTTP estático; no abras sus páginas mediante `file://`.

## Rollback del piloto

La implementación anterior del evento piloto sigue respaldada en:

```text
.migration-backups/sofia-y-carlos-before-generator/
```

Ese respaldo no forma parte del build ni de la salida publicable.
