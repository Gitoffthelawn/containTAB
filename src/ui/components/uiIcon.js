/**
 * uiIcon — the single render owner for popup UI icons.
 *
 * Schema: docs/handbook/schemas/uiIcon.schema.json
 *
 * buildIcon(name) is the icon object's render method. It was previously
 * duplicated across RulesSection / ContainersSection / SettingsSection with
 * divergent SVG paths for some shared names. This module is the convergence
 * target: one owner, one render truth per name.
 *
 * Canonical path policy (see schema x-status): the ContainersSection variant
 * is canonical because the popup-smoke-parity gate locks the container list.
 * That variant sets fill/stroke on the <svg> and is the most complete. Names
 * owned only by SettingsSection (clock, rules, settings) are carried over
 * as-is.
 *
 * Size is owned by CSS (.svg-icon and its row/box overrides), never by SVG
 * attributes.
 */

const SVG_NS = 'http://www.w3.org/2000/svg';

function el(name) {
  const node = document.createElementNS(SVG_NS, name);
  return node;
}

/**
 * buildIcon — render method of the uiIcon object.
 * @param {string} name uiIcon name (see schema enum)
 * @returns {SVGElement} inline svg, viewBox '0 0 24 24', class 'svg-icon'
 */
export function buildIcon(name) {
  const svg = el('svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.classList.add('svg-icon');

  const path = (d) => {
    const p = el('path');
    p.setAttribute('d', d);
    svg.appendChild(p);
  };
  const line = (x1, y1, x2, y2) => {
    const l = el('line');
    l.setAttribute('x1', x1);
    l.setAttribute('y1', y1);
    l.setAttribute('x2', x2);
    l.setAttribute('y2', y2);
    svg.appendChild(l);
  };

  if (name === 'containers') {
    path('M4 4h6v6H4Z');
    path('M14 4h6v6h-6Z');
    path('M4 14h6v6H4Z');
    path('M14 14h6v6h-6Z');
  } else if (name === 'briefcase') {
    path('M10 6V5a2 2 0 0 1 2-2h0a2 2 0 0 1 2 2v1');
    path('M4 7h16v11H4Z');
    path('M4 12h16');
  } else if (name === 'book') {
    path('M4 5a2 2 0 0 1 2-2h5v17H6a2 2 0 0 0-2 2Z');
    path('M20 5a2 2 0 0 0-2-2h-5v17h5a2 2 0 0 1 2 2Z');
  } else if (name === 'cart') {
    path('M4 5h2l2 10h9l2-7H8');
    path('M10 20h.01');
    path('M17 20h.01');
  } else if (name === 'play') {
    path('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z');
    path('m10 8 6 4-6 4Z');
  } else if (name === 'shield') {
    path('M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6Z');
    path('m9.5 12 1.7 1.7 3.8-4');
  } else if (name === 'pin') {
    path('m15 4 5 5-4 1-4 7-2-2 7-4Z');
    path('m9 15-5 5');
  } else if (name === 'search') {
    path('m21 21-4.3-4.3');
    path('M10.8 18a7.2 7.2 0 1 0 0-14.4 7.2 7.2 0 0 0 0 14.4Z');
  } else if (name === 'plus') {
    line('12', '5', '12', '19');
    line('5', '12', '19', '12');
  } else if (name === 'back') {
    path('M19 12H5');
    path('m12 5-7 7 7 7');
  } else if (name === 'clock') {
    path('M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z');
    path('M12 7v5l3 2');
  } else if (name === 'edit') {
    path('M12 20h9');
    path('M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z');
  } else if (name === 'trash') {
    path('M3 6h18');
    path('M8 6V4h8v2');
    path('M19 6l-1 14H6L5 6');
    line('10', '11', '10', '17');
    line('14', '11', '14', '17');
  } else if (name === 'check') {
    path('M20 6 9 17l-5-5');
  } else if (name === 'x') {
    line('18', '6', '6', '18');
    line('6', '6', '18', '18');
  } else if (name === 'chevron') {
    path('m6 9 6 6 6-6');
  } else if (name === 'rules') {
    path('M3 7h12M3 12h18M3 17h9');
    const c1 = el('circle');
    c1.setAttribute('cx', '18'); c1.setAttribute('cy', '7'); c1.setAttribute('r', '2');
    svg.appendChild(c1);
    const c2 = el('circle');
    c2.setAttribute('cx', '15'); c2.setAttribute('cy', '17'); c2.setAttribute('r', '2');
    svg.appendChild(c2);
  } else if (name === 'settings') {
    const c = el('circle');
    c.setAttribute('cx', '12'); c.setAttribute('cy', '12'); c.setAttribute('r', '3');
    svg.appendChild(c);
    path('M19.4 15a8 8 0 0 0 .1-1 8 8 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a7 7 0 0 0-1.7-1L15 5.4h-4L10.7 8a7 7 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a8 8 0 0 0-.1 1 8 8 0 0 0 .1 1l-2 1.5 2 3.5 2.4-1a7 7 0 0 0 1.7 1l.3 2.6h4l.3-2.6a7 7 0 0 0 1.7-1l2.4 1 2-3.5Z');
  }

  return svg;
}

export default buildIcon;
