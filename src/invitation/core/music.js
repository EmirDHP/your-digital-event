import { byId } from "./dom.js";

let initialized = false;
let state = {
  audio: null,
  button: null,
  label: "Reproducir música",
  enabled: false,
  playing: false
};

export function initMusic(music){
  const wrap = byId("musicWrap");
  const button = byId("musicBtn");
  const audio = byId("musicAudio");
  if (!wrap || !button || !audio) return;

  if (!music?.enabled || !music?.src){
    wrap.hidden = true;
    state = {
      audio: null,
      button: null,
      label: "Reproducir música",
      enabled: false,
      playing: false
    };
    return;
  }

  wrap.hidden = false;
  audio.src = music.src;
  audio.loop = true;
  audio.volume = 0.55;

  const baseLabel = music.label || "Reproducir música";
  button.textContent = baseLabel;

  state = {
    audio,
    button,
    label: baseLabel,
    enabled: true,
    playing: false
  };

  if (initialized) return;
  initialized = true;

  button.addEventListener("click", async () => {
    try{
      if (!state.playing){
        await state.audio.play();
        state.playing = true;
        state.button.textContent = "Pausar música";
      }else{
        state.audio.pause();
        state.playing = false;
        state.button.textContent = state.label;
      }
    }catch{
      alert("Tu navegador bloqueó el audio. Toca de nuevo para intentar.");
    }
  });
}

export async function tryAutoplayMusic(){
  if (!state.enabled || !state.audio || state.playing) return;

  try{
    await state.audio.play();
    state.playing = true;
    if (state.button) state.button.textContent = "Pausar música";
  }catch{
    console.info("El navegador bloqueó la reproducción automática.");
  }
}
