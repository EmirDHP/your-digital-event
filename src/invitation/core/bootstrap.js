import { startInvitation } from "./app.js";

function readRuntimeOptions(){
  const element = document.getElementById("theme-runtime-options");
  if (!element) return {};

  try{
    const options = JSON.parse(element.textContent || "{}");
    return options && typeof options === "object" && !Array.isArray(options)
      ? options
      : {};
  }catch{
    console.error("Las opciones del tema no tienen un formato válido.");
    return {};
  }
}

startInvitation(readRuntimeOptions());
