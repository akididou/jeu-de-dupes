// Minuterie d'inactivité : avertissement puis expiration. Module pur, sans accès au DOM.

const MS_PER_SECOND = 1000;

/**
 * @param {{
 *   totalSeconds: number,
 *   warningSeconds: number,
 *   isActive: () => boolean,
 *   onWarn: (remaining: number) => void,
 *   onExpire: () => void,
 * }} options
 * @returns {{ reset: () => void, stop: () => void }}
 */
export function createIdleTimer({ totalSeconds, warningSeconds, isActive, onWarn, onExpire }) {
  let waitTimer = null;
  let countdownTimer = null;

  function stop() {
    clearTimeout(waitTimer);
    clearInterval(countdownTimer);
    waitTimer = null;
    countdownTimer = null;
  }

  function startCountdown() {
    waitTimer = null;
    let remaining = warningSeconds;
    onWarn(remaining);
    countdownTimer = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        stop();
        onExpire();
        return;
      }
      onWarn(remaining);
    }, MS_PER_SECOND);
  }

  function reset() {
    stop();
    if (!isActive()) return;
    waitTimer = setTimeout(startCountdown, (totalSeconds - warningSeconds) * MS_PER_SECOND);
  }

  return { reset, stop };
}
