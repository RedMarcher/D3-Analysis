import * as d3 from 'd3';

/**
 * Attach smooth (exponential-decay) zoom/pan to a D3 selection.
 *
 * Why: Plain D3 zoom snaps instantly. This utility introduces a display
 * transform that lags behind the authoritative zoom state via a half-life
 * decay loop, giving a buttery feel without hiccups.
 *
 * @param {d3.Selection} selection - Element to receive zoom (svg, g, rect, …)
 * @param {object} options
 *   scaleExtent  [min, max] zoom levels (default [1, 8])
 *   halfLife     decay half-life in ms; smaller = snappier (default 30)
 *   onUpdate     fn(displayTransform) called every rAF tick
 *   onZoomChange fn(k) called whenever the authoritative scale changes
 * @returns {{ zoom, zoomIn, zoomOut, resetZoom }}
 */
export function createSmoothZoom(selection, {
  scaleExtent   = [1, 8],
  halfLife      = 30,
  onUpdate      = () => {},
  onZoomChange  = null,
} = {}) {
  const [minScale, maxScale] = scaleExtent;

  // Authoritative targets — what D3 says the transform should be
  let _kTarget = 1, _txTarget = 0, _tyTarget = 0;
  // Display state — visually applied, lags behind targets
  let _displayK = 1, _displayX = 0, _displayY = 0;

  let _visRaf     = null;
  let _isDragging = false;
  let _isWheeling = false;
  let _wheelTimer = null;

  function _apply(t) {
    onUpdate(t);
  }

  function _startDecay() {
    if (_visRaf) return; // already ticking — picks up updated targets
    let lastTime = performance.now();
    const tick = (now) => {
      const dt    = Math.min(now - lastTime, 50);
      lastTime    = now;
      const alpha = 1 - Math.pow(0.5, dt / halfLife);
      _displayK  += (_kTarget  - _displayK)  * alpha;
      _displayX  += (_txTarget - _displayX)  * alpha;
      _displayY  += (_tyTarget - _displayY)  * alpha;
      _apply(d3.zoomIdentity.translate(_displayX, _displayY).scale(_displayK));
      const settled =
        Math.abs(_displayK - _kTarget)  < 0.005 &&
        Math.abs(_displayX - _txTarget) < 0.3   &&
        Math.abs(_displayY - _tyTarget) < 0.3   &&
        !_isDragging && !_isWheeling;
      if (settled) { _visRaf = null; return; }
      _visRaf = requestAnimationFrame(tick);
    };
    _visRaf = requestAnimationFrame(tick);
  }

  const zoom = d3.zoom()
    .scaleExtent(scaleExtent)
    .on('start', (event) => { if (event.sourceEvent) _isDragging = true; })
    .on('zoom',  (event) => {
      if (onZoomChange) onZoomChange(event.transform.k);
      if (!event.sourceEvent) {
        // Programmatic (buttons / reset): sync display immediately, no lag
        _kTarget  = _displayK  = event.transform.k;
        _txTarget = _displayX  = event.transform.x;
        _tyTarget = _displayY  = event.transform.y;
        _apply(event.transform);
      } else {
        // User drag: update targets; visual decay catches up
        _kTarget  = event.transform.k;
        _txTarget = event.transform.x;
        _tyTarget = event.transform.y;
        _startDecay();
      }
    })
    .on('end', (event) => { if (event.sourceEvent) _isDragging = false; });

  selection.call(zoom);

  // Custom wheel: write directly to __zoom so we never fire a conflicting
  // zoom event, which caused the hiccups seen with the default handler.
  selection.on('wheel.zoom', null);
  selection.on('wheel', (event) => {
    event.preventDefault();
    const delta  = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY;
    const factor = Math.exp(-delta * 0.002);
    const [mx, my] = d3.pointer(event, selection.node());
    const kNew  = Math.max(minScale, Math.min(maxScale, _kTarget * factor));
    const txNew = mx - (mx - _txTarget) * (kNew / _kTarget);
    const tyNew = my - (my - _tyTarget) * (kNew / _kTarget);
    selection.node().__zoom = d3.zoomIdentity.translate(txNew, tyNew).scale(kNew);
    _kTarget  = kNew;
    _txTarget = txNew;
    _tyTarget = tyNew;
    _isWheeling = true;
    clearTimeout(_wheelTimer);
    _wheelTimer = setTimeout(() => { _isWheeling = false; }, 150);
    if (onZoomChange) onZoomChange(kNew);
    _startDecay();
  }, { passive: false });

  return {
    zoom,
    zoomIn()   { selection.transition().duration(300).call(zoom.scaleBy, 1.5); },
    zoomOut()  { selection.transition().duration(300).call(zoom.scaleBy, 1 / 1.5); },
    resetZoom() {
      if (_visRaf) { cancelAnimationFrame(_visRaf); _visRaf = null; }
      selection.transition().duration(500).call(zoom.transform, d3.zoomIdentity);
    },
  };
}
