# Bebés y celebraciones familiares

Esta carpeta está reservada para demos de la familia comercial “Bebés y
celebraciones familiares”.

Las invitaciones generadas deben continuar usando el runtime compartido de
`src/invitation/`. Para un bautizo, el contrato es:

```json
{
  "event": {
    "type": "event",
    "subtype": "baptism"
  }
}
```

El tema reutilizable `Alba` cuenta con una demo estática en `alba-demo/`.
Para integrarlo en el catálogo comercial de `eventos.html`, su registro utiliza
`type: "Evento"` y conserva aquí su ruta física. Esta clasificación comercial
no cambia ni se relaciona con el propósito técnico de la carpeta raíz `events/`.
