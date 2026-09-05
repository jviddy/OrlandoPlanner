/**
 * Placeholder park glyphs — simple hand-drawn stroke paths on a 24x24 viewBox,
 * fill:none, stroke:currentColor. The system is "colour = resort, glyph = park";
 * swapping these for a real icon set must not disturb that. Keep this file as the
 * single swap point.
 */
export const GLYPHS = {
  castle:
    'M4 20V11l2.5-3.5L9 11v1h1V7.5L12.5 4 15 7.5V12h1v-1l2-2.5L20 11v9M3 20h18',
  sphere:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18',
  clapper:
    'M3 9h18v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9Zm0 0 1.4-4h15.2L21 9M8.4 5 7 9M13.4 5 12 9M18.4 5 17 9',
  tree: 'M12 21v-6m0 0a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM3.4 9h17.2M3.4 15h17.2',
  island:
    'M3 19c1.6 1.4 3.2 1.4 4.8 0s3.2-1.4 4.8 0 3.2 1.4 4.8 0 1.8.7 3.6 0M12 16V9m0 0c-1.8-2-4-1.6-5.2 0M12 9c1.8-2 4-1.6 5.2 0',
  portal:
    'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4.6a4.4 4.4 0 1 0 0-8.8 4.4 4.4 0 0 0 0 8.8Z',
  volcano: 'M3.5 20h17L14 7h-4L3.5 20ZM10 7l2-3 2 3',
  fin: 'M12 15V4c4.4 2.6 6.4 7 6.4 11M3 19c1.7 1.4 3.4 1.4 5.1 0s3.4-1.4 5.1 0 3.4 1.4 5.1 0 1.1.5 2.7 0',
  water:
    'M3 8c1.7 1.4 3.4 1.4 5.1 0s3.4-1.4 5.1 0 3.4 1.4 5.1 0 1.1.5 2.7 0M3 14c1.7 1.4 3.4 1.4 5.1 0s3.4-1.4 5.1 0 3.4 1.4 5.1 0 1.1.5 2.7 0M3 20c1.7 1.4 3.4 1.4 5.1 0s3.4-1.4 5.1 0 3.4 1.4 5.1 0 1.1.5 2.7 0',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10ZM12 2.5v1.8m0 15.4v1.8M4.4 4.4l1.3 1.3m12.6 12.6 1.3 1.3M2.5 12h1.8m15.4 0h1.8M4.4 19.6l1.3-1.3M18.3 5.7l1.3-1.3',
  bag: 'M6 8h12l1 12H5L6 8Zm3 0V6a3 3 0 0 1 6 0v2',
  moon: 'M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z',
  plane: 'M21 12 3 19.5l3.4-7.5L3 4.5 21 12ZM6.4 12H14',
  plus: 'M12 6v12M6 12h12',
} as const

/** Generic UI icons (not park glyphs). */
export const ICONS = {
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  check: 'M4 12.5 9 17.5 20 6.5',
  x: 'M6 6l12 12M18 6 6 18',
  chevronDown: 'M6 9l6 6 6-6',
  chevronUp: 'M6 15l6-6 6 6',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  warn: 'M12 9v4m0 3v.5M10.3 3.9 2.6 17.4A1.8 1.8 0 0 0 4.2 20h15.6a1.8 1.8 0 0 0 1.6-2.6L13.7 3.9a1.8 1.8 0 0 0-3.4 0Z',
  bell: 'M18 9a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7M10.3 20a2 2 0 0 0 3.4 0',
  info: 'M12 10v6m0-9.5v.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  bed: 'M3 18v-7m0 0V7m0 4h18v7M3 11h5a2.5 2.5 0 0 1 0-5h3a2.5 2.5 0 0 1 0 5',
  ticket:
    'M4 8a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H6a2 2 0 0 1-2-2 2 2 0 0 0 0-4Zm10-2v12',
  plane: 'M21 12 3 19.5l3.4-7.5L3 4.5 21 12ZM6.4 12H14',
  pencil: 'M4 20h4L18.5 9.5a2 2 0 0 0-3-3L5 17v3M14 6.5l3 3',
  calendar: 'M4 5h16a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1ZM3 10h18M8 3v4M16 3v4',
} as const

export type IconName = keyof typeof ICONS
