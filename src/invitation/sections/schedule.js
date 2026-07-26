import { byId } from "../core/dom.js";

export function renderSchedule(items){
  const wrapper = byId("scheduleList");
  if (!wrapper) return;

  wrapper.innerHTML = "";

  (items || []).forEach((item) => {
    const row = document.createElement("div");
    row.className = "tl-item";
    row.innerHTML = `
      <div class="tl-time">${item.time || ""}</div>
      <div class="tl-title">${item.title || ""}</div>
    `;
    wrapper.appendChild(row);
  });
}
