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
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex=\"-1\"])"
].join(",");

function isFocusable(element){
  return element instanceof HTMLElement &&
    !element.hidden &&
    element.getClientRects().length > 0;
}

function focusElement(element){
  if (!(element instanceof HTMLElement)) return;

  try{
    element.focus({ preventScroll: true });
  }catch{
    element.focus();
  }
}

function createModalFocusController(gate, button, focusTargetSelector){
  const backgroundStates = Array.from(document.body.children)
    .filter((element) =>
      element !== gate &&
      element instanceof HTMLElement &&
      !["SCRIPT", "STYLE", "LINK"].includes(element.tagName)
    )
    .map((element) => ({
      element,
      hadInert: element.hasAttribute("inert")
    }));

  backgroundStates.forEach(({ element }) => element.setAttribute("inert", ""));

  const previousGateTabIndex = gate.getAttribute("tabindex");
  gate.setAttribute("tabindex", "-1");

  let released = false;
  let observer = null;

  const focusGate = () => {
    const focusable = Array.from(gate.querySelectorAll(FOCUSABLE_SELECTOR))
      .filter(isFocusable);
    focusElement(focusable[0] || gate);
  };

  const focusInvitation = () => {
    let target = null;

    try{
      target = document.querySelector(focusTargetSelector || ".main");
    }catch{
      target = document.querySelector(".main");
    }

    if (!(target instanceof HTMLElement)) return;

    const previousTabIndex = target.getAttribute("tabindex");
    target.setAttribute("tabindex", "-1");
    focusElement(target);

    target.addEventListener("blur", () => {
      if (previousTabIndex === null) target.removeAttribute("tabindex");
      else target.setAttribute("tabindex", previousTabIndex);
    }, { once: true });
  };

  const handleKeydown = (event) => {
    if (event.key !== "Tab" || !gate.isConnected) return;

    const focusable = Array.from(gate.querySelectorAll(FOCUSABLE_SELECTOR))
      .filter(isFocusable);

    if (focusable.length === 0){
      event.preventDefault();
      focusElement(gate);
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && (active === first || !gate.contains(active))){
      event.preventDefault();
      focusElement(last);
    }else if (!event.shiftKey && (active === last || !gate.contains(active))){
      event.preventDefault();
      focusElement(first);
    }
  };

  const handleFocusIn = (event) => {
    if (!released && gate.isConnected && !gate.contains(event.target)) focusGate();
  };

  const release = ({ moveFocus = true } = {}) => {
    if (released) return;
    released = true;
    observer?.disconnect();
    document.removeEventListener("keydown", handleKeydown, true);
    document.removeEventListener("focusin", handleFocusIn, true);

    backgroundStates.forEach(({ element, hadInert }) => {
      if (!hadInert) element.removeAttribute("inert");
    });

    if (previousGateTabIndex === null) gate.removeAttribute("tabindex");
    else gate.setAttribute("tabindex", previousGateTabIndex);

    if (moveFocus) focusInvitation();
  };

  document.addEventListener("keydown", handleKeydown, true);
  document.addEventListener("focusin", handleFocusIn, true);

  if (typeof MutationObserver === "function"){
    observer = new MutationObserver(() => {
      if (!gate.isConnected) release();
    });
    observer.observe(document.body, { childList: true });
  }

  focusElement(button);

  return { focusGate, release };
}

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

export function initGate({
  tryAutoplay,
  openDelayMs = 0,
  openingClass = "is-opening",
  manageModalFocus = false,
  focusTargetSelector = ".main"
} = {}){
  const gate = byId("gate");
  const button = byId("openInvite");
  if (!gate || !button) return;
  if (initializedGates.has(gate)) return;

  initializedGates.add(gate);
  gate.dataset.gateReady = "true";
  updateGateHint();

  const normalizedDelay = Number.isFinite(Number(openDelayMs))
    ? Math.min(Math.max(Number(openDelayMs), 0), 4000)
    : 0;
  const normalizedOpeningClass = /^[a-z][a-z0-9-]*$/i.test(openingClass)
    ? openingClass
    : "is-opening";
  const modalFocus = manageModalFocus
    ? createModalFocusController(gate, button, focusTargetSelector)
    : null;

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

  const completeGateExit = ({ source, dragDistance }) => {
    document.body.classList.remove("locked");

    const heroContent = document.querySelector(".hero-content");
    if (heroContent) heroContent.classList.add("revealed");

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

    setTimeout(() => {
      modalFocus?.release();
      gate.remove();
    }, duration + 80);
  };

  const startGateExit = ({ source = "button" } = {}) => {
    if (opening || !gate.isConnected) return;
    const dragDistance = source === "swipe" ? currentDragDistance : 0;
    opening = true;
    clearResetTimer();
    resetPointer();
    removeGestureListeners();
    button.disabled = true;
    modalFocus?.focusGate();
    gate.style.setProperty("pointer-events", "none");
    gate.classList.add(normalizedOpeningClass);

    if (typeof tryAutoplay === "function"){
      Promise.resolve(tryAutoplay({ source })).catch(() => {});
    }

    const delay = prefersReducedMotion() ? 0 : normalizedDelay;
    setTimeout(() => completeGateExit({ source, dragDistance }), delay);
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
