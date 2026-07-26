function loadEmbeddedConfig(){
  const element = document.getElementById("event-config");
  if (!element) return null;

  try{
    const config = JSON.parse(element.textContent || "");
    if (!config || typeof config !== "object" || Array.isArray(config)){
      throw new TypeError("Invalid embedded configuration.");
    }
    return config;
  }catch{
    throw new Error("La configuración incrustada no tiene un formato válido.");
  }
}

export async function loadConfig(url = "config.json"){
  const embeddedConfig = loadEmbeddedConfig();
  if (embeddedConfig) return embeddedConfig;

  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("No se pudo cargar la configuración.");

  const config = await response.json();
  if (!config || typeof config !== "object" || Array.isArray(config)){
    throw new Error("La configuración no tiene un formato válido.");
  }

  return config;
}
