import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';
import { APP_FONT_FAMILY, APP_FONT_FAMILY_BOLD } from './typography';

function shouldUseBold(weight: unknown): boolean {
  if (typeof weight === 'number') {
    return weight >= 500;
  }

  if (typeof weight === 'string') {
    if (weight === 'bold') {
      return true;
    }

    const numericWeight = Number(weight);
    return Number.isFinite(numericWeight) && numericWeight >= 500;
  }

  return false;
}

function mapFonts(baseTheme: MD3Theme) {
  return Object.fromEntries(
    Object.entries(baseTheme.fonts).map(([variant, fontDef]) => {
      const useBold = shouldUseBold((fontDef as { fontWeight?: unknown }).fontWeight);

      return [
        variant,
        {
          ...fontDef,
          fontFamily: useBold ? APP_FONT_FAMILY_BOLD : APP_FONT_FAMILY,
          fontWeight: 'normal' as const,
        },
      ];
    })
  ) as MD3Theme['fonts'];
}

export const lightPaperTheme: MD3Theme = {
  ...MD3LightTheme,
  fonts: mapFonts(MD3LightTheme),
};

export const darkPaperTheme: MD3Theme = {
  ...MD3DarkTheme,
  fonts: mapFonts(MD3DarkTheme),
};
