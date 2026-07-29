const COLOR_PATTERN = /^#[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})?$/;
const VARIABLE_PATTERN = /^--[a-z][a-z0-9-]*$/;

function asRecord(value){
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : null;
}

export function resolveThemePalette(palette, paletteVariables){
  if (palette === undefined) return [];

  const values = asRecord(palette);
  const variables = asRecord(paletteVariables);
  if (!values || !variables){
    throw new TypeError("La paleta del evento o su contrato de tema no son válidos.");
  }

  return Object.entries(values).map(([key, color]) => {
    const variable = variables[key];
    if (!VARIABLE_PATTERN.test(String(variable || ""))){
      throw new TypeError(`El tema no admite el color de paleta "${key}".`);
    }
    if (!COLOR_PATTERN.test(String(color || ""))){
      throw new TypeError(`El color de paleta "${key}" no es hexadecimal válido.`);
    }
    return { key, variable, color };
  });
}

export function applyThemePalette(
  palette,
  paletteVariables,
  root = document.documentElement
){
  const declarations = resolveThemePalette(palette, paletteVariables);
  declarations.forEach(({ variable, color }) => {
    root.style.setProperty(variable, color);
  });
  return declarations.length;
}
