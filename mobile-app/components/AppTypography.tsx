import React from 'react';
import {
  Animated,
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  TextInputProps,
  TextProps,
} from 'react-native';
import { useAppTheme } from '../context/AppThemeContext';
import { APP_FONT_FAMILY, APP_FONT_FAMILY_BOLD } from '../lib/typography';

const APP_FONT_SCALE = 0.92;

function isBoldWeight(fontWeight: unknown): boolean {
  if (fontWeight === 'bold') {
    return true;
  }

  if (typeof fontWeight === 'string') {
    const numericWeight = Number(fontWeight);
    return Number.isFinite(numericWeight) && numericWeight >= 500;
  }

  if (typeof fontWeight === 'number') {
    return fontWeight >= 500;
  }

  return false;
}

function resolveGlobalFont(
  style: TextProps['style'] | TextInputProps['style'],
  defaultTextColor: string
) {
  const flattenedStyle = StyleSheet.flatten(style as any) ?? {};
  const shouldUseBold = isBoldWeight(flattenedStyle.fontWeight);
  const resolvedColor = flattenedStyle.color ?? defaultTextColor;
  const resolvedFontSize =
    typeof flattenedStyle.fontSize === 'number'
      ? Math.max(8, Math.round(flattenedStyle.fontSize * APP_FONT_SCALE))
      : undefined;

  return {
    fontFamily: shouldUseBold ? APP_FONT_FAMILY_BOLD : APP_FONT_FAMILY,
    color: resolvedColor,
    ...(resolvedFontSize ? { fontSize: resolvedFontSize } : {}),
    // Prevent Android fallback to system fonts when custom fonts combine with fontWeight.
    fontWeight: 'normal' as const,
  };
}

export function AppText(props: TextProps) {
  const { colors } = useAppTheme();
  const { style, ...rest } = props;
  return <RNText {...rest} style={[style, resolveGlobalFont(style, colors.text)]} />;
}

export function AppTextInput(props: TextInputProps) {
  const { colors } = useAppTheme();
  const { style, ...rest } = props;
  return <RNTextInput {...rest} style={[style, resolveGlobalFont(style, colors.text)]} />;
}

export const AppAnimatedText = Animated.createAnimatedComponent(AppText);
