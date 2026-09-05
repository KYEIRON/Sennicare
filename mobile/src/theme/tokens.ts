/**
 * Design tokens taken verbatim from the V28 prototype's `:root` block.
 * V28 is the visual source of truth: nothing here is a redesign.
 */
export const colors = {
  bg: '#f7f4ee',
  card: '#fffdf9',
  ink: '#252522',
  muted: '#77756f',
  sage: '#70806a',
  sage2: '#e3e9df',
  sand: '#eee5d6',
  line: '#e4dfd5',
  accent: '#c98263',

  // Recurring surfaces from the stylesheet.
  warm: '#f0ece4',
  warmAlt: '#f1eee7',
  tag: '#f5f2eb',
  search: '#eeece6',
  cookDark: '#1f211e',
  aiBg: '#eef1e9',
  aiLine: '#dfe4db',
  aiBorder: '#d9e1d5',
  reward: '#f0eadf',
  scan: '#f5f1e9',
  scanLine: '#cfc9bc',
  chipInk: '#475143',
  sageDeep: '#354032',
  tabIdle: '#85827a',
  noticeInk: '#5f5b54',
  legalInk: '#625e56',
  tagInk: '#5c5a53',
  miniInk: '#57544d',
  atlasInk: '#5e5b55',
  flagInk: '#485345',
  tabletBg: '#eeeae2',
  track: '#ece9e1',
  progressTrack: '#e8e4db',
  closeBg: '#eeeae2',
} as const;

/** `--shadow: 0 8px 26px rgba(45,40,30,.065)` */
export const shadow = {
  shadowColor: 'rgb(45, 40, 30)',
  shadowOpacity: 0.065,
  shadowRadius: 13,
  shadowOffset: { width: 0, height: 8 },
  elevation: 2,
} as const;

export const radii = {
  card: 24,
  cardTablet: 28,
  hero: 26,
  tile: 20,
  chip: 999,
  button: 15,
  field: 15,
  small: 17,
} as const;
