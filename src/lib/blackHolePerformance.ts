/** Budget only the diffuse glow. The scene resolution and motion never change. */
export function createBloomCadence() {
  let rate = 60;
  let previousTick = -Infinity, previousRate = 0;
  let warmup = 0, duration = 0, frames = 0, slowFrames = 0, slowWindows = 0;

  function resetWindow() {
    duration = 0; frames = 0; slowFrames = 0;
  }

  return {
    get rate() { return rate; },
    sample(elapsed: number) {
      if (rate === 15 || elapsed <= 0) return;
      // Ignore loading, tab switches and isolated long tasks. Two complete
      // slow windows are required, so one dropped frame cannot change the glow.
      if (elapsed > 250) { resetWindow(); slowWindows = 0; return; }
      if (warmup < 2000) { warmup += elapsed; return; }
      duration += elapsed; frames++;
      const threshold = rate === 60 ? 20 : 32;
      if (elapsed > threshold) slowFrames++;
      if (duration < 3000) return;
      const mean = duration / frames;
      const sustained = mean > threshold && slowFrames / frames > 0.4;
      slowWindows = sustained ? slowWindows + 1 : 0;
      if (slowWindows >= 2) {
        rate = mean > 32 ? 15 : 30;
        slowWindows = 0;
      }
      resetWindow();
      // Retain the lighter cadence for this visit; repeatedly switching back
      // and forth would turn transient load into visible changes in the glow.
    },
    shouldUpdate(time: number) {
      const tick = Math.floor(time * rate + 0.000001);
      if (tick === previousTick && rate === previousRate) return false;
      previousTick = tick; previousRate = rate;
      return true;
    },
    invalidate() { previousTick = -Infinity; },
    resume() {
      warmup = 0; slowWindows = 0; resetWindow();
    },
  };
}
