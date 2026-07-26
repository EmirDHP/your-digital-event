import { byId, safeText } from "./dom.js";

let countdownTimerId = null;

function pad2(value){
  return String(value).padStart(2, "0");
}

function formatCountdown(diffMs){
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

function renderPlaceholder(){
  safeText(byId("cdDays"), "--");
  safeText(byId("cdHours"), "--");
  safeText(byId("cdMins"), "--");
  safeText(byId("cdSecs"), "--");
}

function renderCountdown(diffMs){
  const { days, hours, minutes, seconds } = formatCountdown(diffMs);
  safeText(byId("cdDays"), days);
  safeText(byId("cdHours"), pad2(hours));
  safeText(byId("cdMins"), pad2(minutes));
  safeText(byId("cdSecs"), pad2(seconds));
}

export function stopCountdown(){
  if (countdownTimerId === null) return;
  clearInterval(countdownTimerId);
  countdownTimerId = null;
}

export function startCountdown(dateISO){
  stopCountdown();

  const targetMs = Date.parse(dateISO);
  if (!Number.isFinite(targetMs)){
    renderPlaceholder();
    console.warn("La fecha configurada para la cuenta regresiva no es válida.");
    return;
  }

  const tick = () => {
    const diff = targetMs - Date.now();
    renderCountdown(diff);
    if (diff <= 0) stopCountdown();
  };

  tick();
  if (targetMs > Date.now()){
    countdownTimerId = setInterval(tick, 1000);
  }
}
