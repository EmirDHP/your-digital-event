import { byId } from "./dom.js";

let fallbackScheduled = false;
const initializedGates = new WeakSet();
const SWIPE_UP_THRESHOLD = 72;
const VERTICAL_GESTURE_RATIO = 1.2;
const GESTURE_INTENT_THRESHOLD = 8;
const DRAG_RESISTANCE = 0.74;
const MAX_DRAG_DISTANCE = 220;
const RETURN_DURATION_MS = 240;
const BUTTON_EXIT_DURATION_MS = 720;
const SWIPE_EXIT_MIN_DURATION_MS = 300;
const SWIPE_EXIT_MAX_DURATION_MS = 430;
const RETURN_EASING = "cubic-bezier(.22, 1, .36, 1)";
const SWIPE_EXIT_EASING = "cubic-bezier(.22, 1, .36, 1)";
const BUTTON_EXIT_EASING = "cubic-bezier(.32, .08, .6, 1)";
const EXIT_OPACITY_EASING = "cubic-bezier(.5, 0, 1, 1)";

function supportsTouchInteraction(){
  const coarsePointer = window.matchMedia?.("(any-pointer: coarse)")?.matches;
  return Boolean(coarsePointer || navigator.maxTouchPoints > 0);
}

export function updateGateHint(){
  const gate = byId("gate");
  if (!gate) return;

  const hint = gate.querySelector(".gate-hint");
  if (!hint) return;

  hint.textContent = supportsTouchInteraction()
    ? "Desliza hacia arriba para explorar"
    : "Abre la invitación para comenzar";
}

export function scheduleHeroRevealFallback(){
  if (fallbackScheduled) return;
  fallbackScheduled = true;

  setTimeout(() => {
    const heroContent = document.querySelector(".hero-content");
    if (heroContent) heroContent.classList.add("revealed");
  }, 150);
}

export function initGate({ tryAutoplay } = {}){
  const gate = byId("gate");
  const button = byId("openInvite");
  if (!gate || !button) return;
  if (initializedGates.has(gate)) return;

  initializedGates.add(gate);
  updateGateHint();

  let opening = false;
  let activePointerId = null;
  let touchStartX = 0;
  let touchStartY = 0;
  let gestureAxis = null;
  let resetTimer = null;
  let currentDragDistance = 0;

  const prefersReducedMotion = () =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches === true;

  const clearResetTimer = () => {
    if (resetTimer === null) return;
    clearTimeout(resetTimer);
    resetTimer = null;
  };

  const clearInteractionStyles = () => {
    currentDragDistance = 0;
    gate.style.removeProperty("transform");
    gate.style.removeProperty("opacity");
    gate.style.removeProperty("transition");
    gate.style.removeProperty("will-change");
  };

  const resetPointer = () => {
    activePointerId = null;
    touchStartX = 0;
    touchStartY = 0;
    gestureAxis = null;
  };

  const returnGateToRest = () => {
    resetPointer();
    clearResetTimer();

    if (prefersReducedMotion()){
      clearInteractionStyles();
      return;
    }

    gate.style.setProperty(
      "transition",
      `transform ${RETURN_DURATION_MS}ms ${RETURN_EASING}, opacity ${RETURN_DURATION_MS}ms ease`
    );
    gate.style.setProperty(
      "transform",
      "translate3d(0, 0, 0) scale(1)",
      "important"
    );
    gate.style.setProperty("opacity", "1");
    currentDragDistance = 0;

    resetTimer = setTimeout(() => {
      resetTimer = null;
      if (!opening && activePointerId === null) clearInteractionStyles();
    }, RETURN_DURATION_MS);
  };

  const removeGestureListeners = () => {
    gate.removeEventListener("pointerdown", handlePointerDown);
    gate.removeEventListener("pointermove", handlePointerMove);
    gate.removeEventListener("pointerup", handlePointerUp);
    gate.removeEventListener("pointercancel", handlePointerCancel);
    gate.style.removeProperty("touch-action");
  };

  const getExitTiming = (source, dragDistance) => {
    if (source !== "swipe"){
      return {
        duration: BUTTON_EXIT_DURATION_MS,
        easing: BUTTON_EXIT_EASING
      };
    }

    const fullDistance = Math.max(window.innerHeight * 1.05, 1);
    const remainingRatio = Math.max(
      0,
      Math.min(1, (fullDistance - dragDistance) / fullDistance)
    );
    const proportionalDuration = Math.round(
      SWIPE_EXIT_MAX_DURATION_MS * remainingRatio
    );

    return {
      duration: Math.max(
        SWIPE_EXIT_MIN_DURATION_MS,
        Math.min(SWIPE_EXIT_MAX_DURATION_MS, proportionalDuration)
      ),
      easing: SWIPE_EXIT_EASING
    };
  };

  const revealInvitationContent = (duration, easing) => {
    if (prefersReducedMotion()) return;

    const content = document.querySelector(".main");
    if (!content || typeof content.animate !== "function") return;

    const canScale = getComputedStyle(content).transform === "none";
    const from = { opacity: 0.94 };
    const to = { opacity: 1 };

    if (canScale){
      from.transform = "scale(.992)";
      to.transform = "scale(1)";
    }

    content.animate([from, to], {
      duration,
      easing,
      fill: "none"
    });
  };

  const startGateExit = ({ source = "button" } = {}) => {
    if (opening || !gate.isConnected) return;
    const dragDistance = source === "swipe" ? currentDragDistance : 0;
    opening = true;
    clearResetTimer();
    resetPointer();
    removeGestureListeners();
    button.disabled = true;
    gate.style.setProperty("pointer-events", "none");

    document.body.classList.remove("locked");

    const heroContent = document.querySelector(".hero-content");
    if (heroContent) heroContent.classList.add("revealed");

    if (typeof tryAutoplay === "function"){
      Promise.resolve(tryAutoplay()).catch(() => {});
    }

    const reducedMotion = prefersReducedMotion();
    const timing = getExitTiming(source, dragDistance);
    const duration = reducedMotion ? 80 : timing.duration;
    const easing = reducedMotion ? "linear" : timing.easing;
    const opacityDelay = reducedMotion ? 0 : Math.round(duration * 0.55);
    const opacityDuration = reducedMotion ? duration : duration - opacityDelay;

    revealInvitationContent(duration, easing);

    gate.style.setProperty("will-change", "transform, opacity");
    gate.style.setProperty(
      "transition",
      reducedMotion
        ? `opacity ${duration}ms linear`
        : `transform ${duration}ms ${easing}, opacity ${opacityDuration}ms ${EXIT_OPACITY_EASING} ${opacityDelay}ms`
    );

    // Commit the current drag position before setting the shared exit target.
    gate.getBoundingClientRect();
    gate.style.setProperty(
      "transform",
      reducedMotion ? "none" : "translate3d(0, -105%, 0) scale(.995)",
      "important"
    );
    gate.style.setProperty("opacity", "0");

    setTimeout(() => gate.remove(), duration);
  };

  function handlePointerDown(event){
    if (
      opening ||
      event.pointerType !== "touch" ||
      event.isPrimary === false ||
      activePointerId !== null
    ) return;

    clearResetTimer();
    activePointerId = event.pointerId;
    touchStartX = event.clientX;
    touchStartY = event.clientY;
    gestureAxis = null;
    gate.style.setProperty("will-change", "transform, opacity");
    gate.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event){
    if (
      opening ||
      event.pointerId !== activePointerId ||
      prefersReducedMotion()
    ) return;

    const deltaX = event.clientX - touchStartX;
    const deltaY = touchStartY - event.clientY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (gestureAxis === null && Math.max(absX, absY) >= GESTURE_INTENT_THRESHOLD){
      gestureAxis = absY > absX * VERTICAL_GESTURE_RATIO
        ? "vertical"
        : "horizontal";
    }

    if (gestureAxis !== "vertical") return;

    const upwardDistance = Math.max(0, deltaY);
    const visualDistance = Math.min(
      upwardDistance * DRAG_RESISTANCE,
      Math.min(MAX_DRAG_DISTANCE, window.innerHeight * 0.32)
    );
    currentDragDistance = visualDistance;
    const progress = Math.min(upwardDistance / (SWIPE_UP_THRESHOLD * 2), 1);
    const opacity = 1 - progress * 0.08;
    const scale = 1 - progress * 0.006;

    gate.style.setProperty("transition", "none");
    gate.style.setProperty(
      "transform",
      `translate3d(0, -${visualDistance.toFixed(2)}px, 0) scale(${scale.toFixed(4)})`,
      "important"
    );
    gate.style.setProperty("opacity", opacity.toFixed(3));
  }

  function handlePointerUp(event){
    if (opening || event.pointerId !== activePointerId) return;

    const deltaX = event.clientX - touchStartX;
    const deltaY = touchStartY - event.clientY;
    const isUpwardSwipe = deltaY >= SWIPE_UP_THRESHOLD;
    const isPrimarilyVertical = deltaY > Math.abs(deltaX) * VERTICAL_GESTURE_RATIO;

    if (isUpwardSwipe && isPrimarilyVertical){
      startGateExit({ source: "swipe" });
    }else{
      returnGateToRest();
    }
  }

  function handlePointerCancel(event){
    if (opening || event.pointerId !== activePointerId) return;
    returnGateToRest();
  }

  button.addEventListener("click", () => startGateExit({ source: "button" }));

  if (supportsTouchInteraction() && "PointerEvent" in window){
    gate.style.setProperty("touch-action", "pan-x");
    gate.addEventListener("pointerdown", handlePointerDown);
    gate.addEventListener("pointermove", handlePointerMove);
    gate.addEventListener("pointerup", handlePointerUp);
    gate.addEventListener("pointercancel", handlePointerCancel);
  }
}
