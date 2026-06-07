import 'package:flutter/material.dart';

/// Design tokens aligned with repo root [DESIGN.md](../../../DESIGN.md).
/// Update both when the design system changes.
abstract final class FaseaColors {
  static const Color primary = Color(0xFFA66A4A);
  static const Color onPrimary = Color(0xFFFFFFFF);
  static const Color secondary = Color(0xFF716D64);
  static const Color tertiary = Color(0xFF444444);
  static const Color canvas = Color(0xFFFAF8F6);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceMuted = Color(0xFFFFFCFA);
  static const Color border = Color(0xFFE8DDD4);
  static const Color borderStrong = Color(0xFFD4C4BA);
  static const Color tonalButton = Color(0xFFDFD1C9);
  static const Color focusRing = Color(0xFFDFD1C9);
  static const Color error = Color(0xFFB42318);
  static const Color errorSurface = Color(0xFFFCE8E6);
}

abstract final class FaseaRadii {
  static const double sm = 12;
  static const double md = 16;
  static const double lg = 24;
}

abstract final class FaseaSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 16;
  static const double lg = 24;
  static const double gutter = 18;
}

ThemeData buildFaseaTheme() {
  final base = ColorScheme.fromSeed(
    seedColor: FaseaColors.primary,
    brightness: Brightness.light,
    primary: FaseaColors.primary,
    onPrimary: FaseaColors.onPrimary,
    surface: FaseaColors.surface,
    onSurface: FaseaColors.tertiary,
    error: FaseaColors.error,
    onError: FaseaColors.onPrimary,
    outline: FaseaColors.border,
  );

  return ThemeData(
    useMaterial3: true,
    scaffoldBackgroundColor: FaseaColors.canvas,
    colorScheme: base.copyWith(
      surfaceContainerHighest: FaseaColors.surfaceMuted,
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: FaseaColors.canvas,
      foregroundColor: FaseaColors.tertiary,
      elevation: 0,
      scrolledUnderElevation: 0,
    ),
    navigationBarTheme: NavigationBarThemeData(
      backgroundColor: FaseaColors.surface,
      indicatorColor: FaseaColors.tonalButton,
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return TextStyle(
          fontSize: 12,
          fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
          color: selected ? FaseaColors.primary : FaseaColors.secondary,
        );
      }),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return IconThemeData(
          color: selected ? FaseaColors.primary : FaseaColors.secondary,
        );
      }),
    ),
    cardTheme: CardThemeData(
      elevation: 0,
      color: FaseaColors.surface.withValues(alpha: 0.75),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(FaseaRadii.lg),
        side: const BorderSide(color: FaseaColors.border),
      ),
      margin: const EdgeInsets.symmetric(vertical: FaseaSpacing.sm),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: FaseaColors.tonalButton,
        foregroundColor: FaseaColors.tertiary,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: FaseaSpacing.lg, vertical: 14),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(FaseaRadii.lg * 2),
        ),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: FaseaColors.surface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(FaseaRadii.md),
        borderSide: const BorderSide(color: FaseaColors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(FaseaRadii.md),
        borderSide: const BorderSide(color: FaseaColors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(FaseaRadii.md),
        borderSide: const BorderSide(color: FaseaColors.focusRing, width: 2),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: FaseaSpacing.md, vertical: 14),
      hintStyle: const TextStyle(color: FaseaColors.secondary, fontSize: 14),
    ),
    listTileTheme: ListTileThemeData(
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(FaseaRadii.md),
      ),
    ),
    dividerTheme: const DividerThemeData(
      color: FaseaColors.border,
      thickness: 1,
      space: 1,
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: FaseaColors.tertiary,
      contentTextStyle: const TextStyle(
        color: FaseaColors.surface,
        fontSize: 14,
        fontWeight: FontWeight.w500,
      ),
      behavior: SnackBarBehavior.floating,
      elevation: 6,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(FaseaRadii.md),
      ),
    ),
    dialogTheme: DialogThemeData(
      backgroundColor: FaseaColors.surface,
      surfaceTintColor: Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(FaseaRadii.lg),
      ),
    ),
    progressIndicatorTheme: const ProgressIndicatorThemeData(
      color: FaseaColors.primary,
      circularTrackColor: FaseaColors.border,
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: FaseaColors.tertiary,
        side: const BorderSide(color: FaseaColors.border),
        padding: const EdgeInsets.symmetric(
          horizontal: FaseaSpacing.lg,
          vertical: 14,
        ),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(FaseaRadii.lg * 2),
        ),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: FaseaColors.primary),
    ),
    textTheme: const TextTheme(
      headlineMedium: TextStyle(
        fontSize: 22,
        fontWeight: FontWeight.w600,
        height: 1.25,
        color: FaseaColors.tertiary,
      ),
      titleLarge: TextStyle(
        fontSize: 20,
        fontWeight: FontWeight.w600,
        height: 1.3,
        color: FaseaColors.tertiary,
      ),
      bodyLarge: TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w400,
        height: 1.45,
        color: FaseaColors.tertiary,
      ),
      bodyMedium: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        height: 1.45,
        color: FaseaColors.tertiary,
      ),
      bodySmall: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w400,
        height: 1.35,
        color: FaseaColors.secondary,
      ),
      labelLarge: TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w500,
        color: FaseaColors.tertiary,
      ),
    ),
  );
}
