import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { createIdleTimer } from '../../js/idle.js';

const TOTAL_SECONDS = 60;
const WARNING_SECONDS = 10;

function setup(isActive = () => true) {
  const onWarn = vi.fn();
  const onExpire = vi.fn();
  const timer = createIdleTimer({
    totalSeconds: TOTAL_SECONDS,
    warningSeconds: WARNING_SECONDS,
    isActive,
    onWarn,
    onExpire,
  });
  return { timer, onWarn, onExpire };
}

describe('createIdleTimer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test("déclenche l'avertissement à 50 s, décompte chaque seconde et expire à 60 s", () => {
    const { timer, onWarn, onExpire } = setup();
    timer.reset();

    vi.advanceTimersByTime(49_000);
    expect(onWarn).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1_000);
    expect(onWarn).toHaveBeenLastCalledWith(10);

    vi.advanceTimersByTime(1_000);
    expect(onWarn).toHaveBeenLastCalledWith(9);
    expect(onExpire).not.toHaveBeenCalled();

    vi.advanceTimersByTime(9_000);
    expect(onExpire).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  test("un reset à 55 s repousse l'expiration à 115 s", () => {
    const { timer, onExpire } = setup();
    timer.reset();

    vi.advanceTimersByTime(55_000);
    timer.reset();

    vi.advanceTimersByTime(59_000);
    expect(onExpire).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1_000);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  test("ne programme rien quand isActive est faux", () => {
    const { timer, onWarn, onExpire } = setup(() => false);
    timer.reset();

    vi.advanceTimersByTime(120_000);
    expect(onWarn).not.toHaveBeenCalled();
    expect(onExpire).not.toHaveBeenCalled();
  });

  test("un reset pendant le décompte l'annule", () => {
    const { timer, onWarn, onExpire } = setup();
    timer.reset();

    vi.advanceTimersByTime(55_000);
    onWarn.mockClear();
    timer.reset();

    vi.advanceTimersByTime(40_000);
    expect(onWarn).not.toHaveBeenCalled();
    expect(onExpire).not.toHaveBeenCalled();
  });

  test("stop annule tout sans rien appeler", () => {
    const { timer, onWarn, onExpire } = setup();
    timer.reset();
    vi.advanceTimersByTime(55_000);
    onWarn.mockClear();

    timer.stop();
    vi.advanceTimersByTime(120_000);
    expect(onWarn).not.toHaveBeenCalled();
    expect(onExpire).not.toHaveBeenCalled();
  });

  test("reste inactif après l'expiration jusqu'au prochain reset", () => {
    const { timer, onExpire } = setup();
    timer.reset();
    vi.advanceTimersByTime(60_000);
    expect(onExpire).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(120_000);
    expect(onExpire).toHaveBeenCalledTimes(1);

    timer.reset();
    vi.advanceTimersByTime(60_000);
    expect(onExpire).toHaveBeenCalledTimes(2);
  });
});
