/**
 * Some phone browsers (Chrome on iOS, in-app browsers) resize the page itself
 * as their toolbars slide away, so every viewport unit, `svh` included, changes
 * during a scroll. Anything sized from the viewport height then grows and
 * shrinks under the finger; the hero stretched the black hole that way.
 *
 * On touch devices this keeps the given CSS properties at the size they arrived
 * with and measures them again only when the viewport really changes: a new
 * width, or a height change too large to be a toolbar.
 */
export function holdViewportSize(element: HTMLElement, properties: string[]) {
  if (!matchMedia('(any-pointer: coarse)').matches) return;
  let width = 0, height = 0;
  const hold = () => {
    if (innerWidth === width && Math.abs(innerHeight - height) < height * 0.25) return;
    for (const property of properties) element.style.removeProperty(property);
    const computed = getComputedStyle(element);
    const measured = properties.map((property) => computed.getPropertyValue(property));
    // Until the stylesheet applies these read as zero; `load` and `resize` try again.
    if (!measured.every((value) => value.endsWith('px') && parseFloat(value) > 0)) return;
    width = innerWidth; height = innerHeight;
    properties.forEach((property, i) => element.style.setProperty(property, measured[i]));
  };
  hold();
  addEventListener('resize', hold);
  addEventListener('load', hold);
}
