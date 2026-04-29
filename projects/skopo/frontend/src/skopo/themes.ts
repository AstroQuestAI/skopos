export type SkopoThemeName =
  | 'violetAmberLight'
  | 'violetAmberDark'
  | 'oceanBlueLight'
  | 'oceanBlueDark'
  | 'roseGoldLight'
  | 'roseGoldDark'
  | 'forestGreenLight'
  | 'forestGreenDark'
  | 'midnightSlateLight'
  | 'midnightSlateDark'
  | 'minimalCalm';

export type SkopoTheme = {
  name: SkopoThemeName;
  label: string;
  family: string;
  mode: 'Light' | 'Dark';
  colors: {
    background: string;
    surface: string;
    surfaceAlt: string;
    border: string;
    borderSoft: string;
    text: string;
    textSoft: string;
    textMuted: string;
    accent: string;
    accentStrong: string;
    danger: string;
    dangerSoft: string;
    blue: string;
    buttonSurface: string;
    primaryContainer: string;
    secondary: string;
    warning: string;
    warningContainer: string;
    spam: string;
    spamContainer: string;
    unknown: string;
    unknownContainer: string;
  };
  gradient: string[];
  radius: {
    card: number;
    pill: number;
    icon: number;
  };
};

type ThemeSeed = {
  name: SkopoThemeName;
  family: string;
  primary: string;
  primaryLight: string;
  accent: string;
};

const seeds: ThemeSeed[] = [
  { name: 'violetAmberLight', family: 'Violet Amber', primary: '#5b21b6', primaryLight: '#7c3aed', accent: '#b45309' },
  { name: 'oceanBlueLight', family: 'Ocean Blue', primary: '#0369a1', primaryLight: '#0891b2', accent: '#0891b2' },
  { name: 'roseGoldLight', family: 'Rose Gold', primary: '#be185d', primaryLight: '#db2777', accent: '#d97706' },
  { name: 'forestGreenLight', family: 'Green Gold', primary: '#17713a', primaryLight: '#2fa66a', accent: '#d97706' },
  { name: 'midnightSlateLight', family: 'Midnight Slate', primary: '#334155', primaryLight: '#475569', accent: '#6366f1' },
];

function lightTheme(seed: ThemeSeed): SkopoTheme {
  return {
    name: seed.name,
    label: `${seed.family} Light`,
    family: seed.family,
    mode: 'Light',
    colors: {
      background: seed.name === 'forestGreenLight' ? '#f7f8ff' : '#f8f8fc',
      surface: '#ffffff',
      surfaceAlt: seed.name === 'forestGreenLight' ? '#f0f3fb' : '#f6f4fb',
      border: seed.name === 'forestGreenLight' ? '#dfe5ef' : '#ded7ee',
      borderSoft: seed.name === 'forestGreenLight' ? '#e8edf5' : '#ece7f6',
      text: '#1c1033',
      textSoft: '#4a4063',
      textMuted: seed.name === 'forestGreenLight' ? '#7b7895' : '#7c6fa0',
      accent: '#fcd34d',
      accentStrong: seed.primary,
      danger: '#be123c',
      dangerSoft: '#ffe4e6',
      blue: seed.primaryLight,
      buttonSurface: '#ffffff',
      primaryContainer: seed.name === 'forestGreenLight' ? '#e6f4ee' : '#f0eafd',
      secondary: seed.accent,
      warning: seed.accent,
      warningContainer: '#fef3c7',
      spam: '#be123c',
      spamContainer: '#ffe4e6',
      unknown: '#475569',
      unknownContainer: '#f1f5f9',
    },
    gradient: [seed.primary, seed.primaryLight],
    radius: { card: 20, pill: 18, icon: 16 },
  };
}

function darkTheme(light: SkopoTheme, name: SkopoThemeName): SkopoTheme {
  return {
    ...light,
    name,
    label: `${light.family} Dark`,
    mode: 'Dark',
    colors: {
      ...light.colors,
      background: '#120b26',
      surface: '#1a1030',
      surfaceAlt: '#2d1f4e',
      border: '#3d2e60',
      borderSoft: '#2f2548',
      text: '#ede9fe',
      textSoft: '#cfbcff',
      textMuted: '#9e8dc0',
      accent: '#fcd34d',
      dangerSoft: '#3f1020',
      buttonSurface: '#2d1f4e',
      primaryContainer: '#2d1f4e',
      warningContainer: '#4b2d00',
      spamContainer: '#4a1021',
      unknownContainer: '#263244',
    },
  };
}

const violetAmberLight = lightTheme(seeds[0]);
const oceanBlueLight = lightTheme(seeds[1]);
const roseGoldLight = lightTheme(seeds[2]);
const forestGreenLight = lightTheme(seeds[3]);
const midnightSlateLight = lightTheme(seeds[4]);

export const skopoThemes: Record<SkopoThemeName, SkopoTheme> = {
  violetAmberLight,
  violetAmberDark: darkTheme(violetAmberLight, 'violetAmberDark'),
  oceanBlueLight,
  oceanBlueDark: darkTheme(oceanBlueLight, 'oceanBlueDark'),
  roseGoldLight,
  roseGoldDark: darkTheme(roseGoldLight, 'roseGoldDark'),
  forestGreenLight,
  forestGreenDark: darkTheme(forestGreenLight, 'forestGreenDark'),
  midnightSlateLight,
  midnightSlateDark: darkTheme(midnightSlateLight, 'midnightSlateDark'),
  minimalCalm: {
    name: 'minimalCalm',
    label: 'Minimal Calm',
    family: 'Minimal Calm',
    mode: 'Light',
    colors: {
      background: '#f7f4ed',
      surface: '#ffffff',
      surfaceAlt: '#e8f0ec',
      border: '#e5ded2',
      borderSoft: '#d8e2dc',
      text: '#1d2d26',
      textSoft: '#3c4842',
      textMuted: '#69746e',
      accent: '#1ac48b',
      accentStrong: '#0a8f66',
      danger: '#c93b2f',
      dangerSoft: '#fff5f3',
      blue: '#1580ef',
      buttonSurface: '#ffffff',
      primaryContainer: '#e6f5ef',
      secondary: '#0f766e',
      warning: '#b45309',
      warningContainer: '#fef3c7',
      spam: '#be123c',
      spamContainer: '#ffe4e6',
      unknown: '#475569',
      unknownContainer: '#f1f5f9',
    },
    gradient: ['#0a8f66', '#1ac48b'],
    radius: { card: 8, pill: 24, icon: 22 },
  },
};

export const skopoThemeOrder: SkopoThemeName[] = [
  'violetAmberLight',
  'violetAmberDark',
  'oceanBlueLight',
  'oceanBlueDark',
  'roseGoldLight',
  'roseGoldDark',
  'forestGreenLight',
  'forestGreenDark',
  'midnightSlateLight',
  'midnightSlateDark',
];

export const defaultSkopoThemeName: SkopoThemeName = 'forestGreenLight';
