// TODO memoize this for performance
export function evaluateCSSVariable(color) {
  return window.getComputedStyle(document.body).getPropertyValue(color.match(/\((.*?)\)/)[1]);
}

export function getCounterColor(colorLabel) {
  let color = null;

  color = window.CONFIG.COUNTER_COLORS[colorLabel];

  if (color) {
    return color;
  }
  // Maybe if colors have been modified and old recording are in DB, we need to render a default
  // color
  return '#AEAEAE';
}

export function getAvailableCounterColors() {
  return Object.keys(window.CONFIG.COUNTER_COLORS);
}

export function getDefaultCounterColor() {
  const availableColors = getAvailableCounterColors();
  if (availableColors.length > 0) {
    return availableColors[0];
  }

  return null;
}

export function getPathfinderColors() {
  return window.CONFIG.PATHFINDER_COLORS;
}

export function getDisplayClasses() {
  return window.CONFIG.DISPLAY_CLASSES;
}
