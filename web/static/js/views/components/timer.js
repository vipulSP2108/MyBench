/**
 * Practice Stopwatch & Countdown Timer Component
 */

import { el, showToast } from "../../utils.js";

let timerSeconds = 0;
let timerRunning = false;
let timerInterval = null;
let timerMode = "stopwatch"; // "stopwatch" | "timer"
let timerPopoverMode = "stopwatch";
let timerCountdownTarget = 3600;
let isTimerCollapsed = true;

export const TimerComponent = {
  setupTimerControls() {
    const triggerBtn = el("btn-timer-trigger");
    const popover = el("timer-popover");
    const tileStopwatch = el("popover-tile-stopwatch");
    const tileTimer = el("popover-tile-timer");
    const popoverActionBtn = el("btn-timer-popover-action");
    const toggleRunBtn = el("btn-timer-toggle-run");
    const resetBarBtn = el("btn-timer-reset-bar");
    const collapseBarBtn = el("btn-timer-collapse-bar");

    triggerBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      if (timerRunning && isTimerCollapsed) {
        isTimerCollapsed = false;
        TimerComponent.updateTimerUI();
        return;
      }
      const isHidden = !popover || popover.style.display === "none";
      if (popover) {
        if (isHidden) {
          const rect = triggerBtn.getBoundingClientRect();
          const popoverWidth = 290;
          let left = rect.left;
          if (left + popoverWidth > window.innerWidth - 12) {
            left = window.innerWidth - popoverWidth - 12;
          }
          if (left < 12) left = 12;
          popover.style.position = "fixed";
          popover.style.top = `${rect.bottom + 8}px`;
          popover.style.left = `${left}px`;
          popover.style.zIndex = "10050";
          popover.style.display = "block";
        } else {
          popover.style.display = "none";
        }
      }
    });

    tileStopwatch?.addEventListener("click", () => {
      timerPopoverMode = "stopwatch";
      tileStopwatch.classList.add("active");
      tileTimer.classList.remove("active");
      if (popoverActionBtn) {
        popoverActionBtn.textContent = (timerRunning && timerMode === "stopwatch") ? "Resume Stopwatch" : "Start Stopwatch";
      }
    });

    tileTimer?.addEventListener("click", () => {
      timerPopoverMode = "timer";
      tileTimer.classList.add("active");
      tileStopwatch.classList.remove("active");
      if (popoverActionBtn) {
        popoverActionBtn.textContent = "Start Timer";
      }
    });

    popoverActionBtn?.addEventListener("click", () => {
      if (timerPopoverMode === "stopwatch") {
        timerMode = "stopwatch";
        TimerComponent.startTimer();
        showToast("Stopwatch started");
      } else {
        const hr = parseInt(el("timer-input-hr")?.value || "0", 10) || 0;
        const min = parseInt(el("timer-input-min")?.value || "0", 10) || 0;
        const totalSec = (hr * 3600) + (min * 60);
        timerCountdownTarget = totalSec > 0 ? totalSec : 3600;
        timerSeconds = timerCountdownTarget;
        timerMode = "timer";
        TimerComponent.startTimer();
        showToast(`Countdown timer started (${hr}h ${min}m)`);
      }
      if (popover) popover.style.display = "none";
    });

    toggleRunBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      TimerComponent.toggleTimer();
    });

    resetBarBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      TimerComponent.resetTimer();
      showToast(timerMode === "timer" ? "Timer reset" : "Stopwatch reset");
    });

    collapseBarBtn?.addEventListener("click", (e) => {
      e.stopPropagation();
      isTimerCollapsed = true;
      TimerComponent.updateTimerUI();
    });

    document.addEventListener("click", (e) => {
      if (popover && !popover.contains(e.target) && !triggerBtn?.contains(e.target)) {
        popover.style.display = "none";
      }
    });
  },

  startTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerRunning = true;
    isTimerCollapsed = false;
    TimerComponent.updateTimerUI();

    timerInterval = setInterval(() => {
      if (timerRunning) {
        if (timerMode === "stopwatch") {
          timerSeconds++;
        } else {
          if (timerSeconds > 0) {
            timerSeconds--;
          } else {
            TimerComponent.pauseTimer();
            showToast("Target practice time completed");
            try {
              const ctx = new (window.AudioContext || window.webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.frequency.setValueAtTime(587.33, ctx.currentTime);
              gain.gain.setValueAtTime(0.15, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
              osc.start();
              osc.stop(ctx.currentTime + 0.6);
            } catch (e) {}
          }
        }
        TimerComponent.updateTimerUI();
      }
    }, 1000);
  },

  pauseTimer() {
    timerRunning = false;
    TimerComponent.updateTimerUI();
  },

  resumeTimer() {
    timerRunning = true;
    TimerComponent.updateTimerUI();
  },

  toggleTimer() {
    if (timerRunning) {
      TimerComponent.pauseTimer();
      showToast("Practice Timer paused");
    } else {
      TimerComponent.resumeTimer();
      showToast("Practice Timer running");
    }
  },

  resetTimer() {
    if (timerMode === "stopwatch") {
      timerSeconds = 0;
    } else {
      timerSeconds = timerCountdownTarget;
    }
    TimerComponent.updateTimerUI();
  },

  updateTimerUI() {
    const triggerBtn = el("btn-timer-trigger");
    const runningDot = el("timer-trigger-badge");
    const activeBar = el("timer-active-bar");
    const digits = el("timer-digits-display");
    const iconPause = el("timer-icon-pause");
    const iconPlay = el("timer-icon-play");

    const hrs = String(Math.floor(timerSeconds / 3600)).padStart(2, "0");
    const mins = String(Math.floor((timerSeconds % 3600) / 60)).padStart(2, "0");
    const secs = String(timerSeconds % 60).padStart(2, "0");
    const formatted = `${hrs}:${mins}:${secs}`;

    if (digits) digits.textContent = formatted;

    if (iconPause && iconPlay) {
      iconPause.style.display = timerRunning ? "block" : "none";
      iconPlay.style.display = timerRunning ? "none" : "block";
    }

    if (triggerBtn) {
      triggerBtn.classList.toggle("running", timerRunning);
    }

    if (runningDot) {
      runningDot.style.display = (timerRunning && isTimerCollapsed) ? "block" : "none";
    }

    if (isTimerCollapsed) {
      if (activeBar) activeBar.style.display = "none";
      if (triggerBtn) triggerBtn.style.display = "inline-flex";
    } else {
      if (activeBar) activeBar.style.display = "inline-flex";
      if (triggerBtn) triggerBtn.style.display = "none";
    }
  }
};
