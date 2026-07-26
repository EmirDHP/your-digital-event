export function getSafeHttpUrl(value){
  try{
    const url = new URL(String(value || ""));
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
  }catch{
    return "";
  }
}

export function buildWhatsAppUrl(number, message){
  const clean = String(number || "").replace(/[^\d]/g, "");
  if (!/^\d{8,15}$/.test(clean)) return "";

  const text = encodeURIComponent(message || "");
  return `https://wa.me/${clean}?text=${text}`;
}
