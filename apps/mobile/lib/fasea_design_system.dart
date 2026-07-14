import 'package:flutter/material.dart';
import 'package:table_calendar/table_calendar.dart';

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

/// Bundled font families — match web (`layout.tsx`: Inter + Playfair Display).
/// Serif is for display moments only (logo, credits, booking code); UI chrome uses Inter.
abstract final class FaseaFonts {
  static const String sans = 'Inter';
  static const String serif = 'Playfair Display';
}

/// Serif styles for brand / numerics — not for section labels or body UI.
abstract final class FaseaTextStyles {
  static const TextStyle display = TextStyle(
    fontFamily: FaseaFonts.serif,
    fontSize: 28,
    fontWeight: FontWeight.w700,
    height: 1.2,
    color: FaseaColors.tertiary,
  );
  static const TextStyle credit = TextStyle(
    fontFamily: FaseaFonts.serif,
    fontSize: 28,
    fontWeight: FontWeight.w700,
    height: 1.15,
    color: FaseaColors.tertiary,
  );
  static const TextStyle bookingCode = TextStyle(
    fontFamily: FaseaFonts.serif,
    fontSize: 32,
    fontWeight: FontWeight.w700,
    color: FaseaColors.primary,
    letterSpacing: 2,
  );
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
  static const double xl = 32;
  static const double gutter = 18;
  /// Extra bottom padding so scroll content clears the tab bar.
  static const double bottomNavInset = 72;

  /// Page headline → next block (chips, card, form).
  static const double afterHeadline = md;
  /// Headline → subtitle on the same screen.
  static const double headlineToSubtitle = sm;
  /// In-page section title → content below it.
  static const double afterSectionTitle = sm;
  /// Between major sections (e.g. credit card → plan group).
  static const double betweenSections = lg;
  /// Stacked form fields.
  static const double betweenFields = md;
  /// Card body → emphasized line (e.g. name block → credit count).
  static const double inCardBeforeEmphasis = md;
  /// Primary button → secondary link in the same card.
  static const double afterPrimaryButton = sm;

  static EdgeInsets screenPadding({
    double extraBottom = 0,
    bool embedded = false,
  }) =>
      EdgeInsets.fromLTRB(
        md,
        embedded ? 0 : md,
        md,
        md + bottomNavInset + extraBottom,
      );
}

String spotsLeftLabel(int count) =>
    count == 1 ? '1 spot left' : '$count spots left';

/// Shared tap targets — mobile-friendly (≥48dp); aligned with DESIGN.md pill CTAs.
abstract final class FaseaButtons {
  static const Size minimumSize = Size(64, 52);
  static const EdgeInsets padding = EdgeInsets.symmetric(
    horizontal: FaseaSpacing.lg,
    vertical: 16,
  );
  static const TextStyle labelStyle = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w600,
    height: 1.25,
  );

  static ButtonStyle filled({Color? backgroundColor, Color? foregroundColor}) {
    return FilledButton.styleFrom(
      backgroundColor: backgroundColor ?? FaseaColors.tonalButton,
      foregroundColor: foregroundColor ?? FaseaColors.tertiary,
      disabledBackgroundColor: const Color(0x99DFD1C9),
      disabledForegroundColor: const Color(0x99716D64),
      elevation: 0,
      minimumSize: minimumSize,
      padding: padding,
      textStyle: labelStyle,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(FaseaRadii.lg * 2),
      ),
    );
  }

  static ButtonStyle outlined() {
    return OutlinedButton.styleFrom(
      foregroundColor: FaseaColors.tertiary,
      side: const BorderSide(color: FaseaColors.border),
      minimumSize: minimumSize,
      padding: padding,
      textStyle: labelStyle,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(FaseaRadii.lg * 2),
      ),
    );
  }

  static ButtonStyle text() {
    return TextButton.styleFrom(
      foregroundColor: FaseaColors.primary,
      minimumSize: const Size(64, 48),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      textStyle: const TextStyle(
        fontSize: 15,
        fontWeight: FontWeight.w600,
      ),
    );
  }
}

CalendarStyle buildFaseaCalendarStyle({
  EdgeInsets cellMargin = const EdgeInsets.all(4),
}) => CalendarStyle(
  cellMargin: cellMargin,
  outsideDaysVisible: false,
  weekendTextStyle: const TextStyle(color: FaseaColors.secondary),
  defaultTextStyle: const TextStyle(color: FaseaColors.tertiary),
  disabledTextStyle: TextStyle(
    color: FaseaColors.secondary.withValues(alpha: 0.38),
  ),
  selectedDecoration: const BoxDecoration(
    color: FaseaColors.secondary,
    shape: BoxShape.circle,
  ),
  todayDecoration: BoxDecoration(
    color: FaseaColors.tonalButton.withValues(alpha: 0.55),
    shape: BoxShape.circle,
    border: Border.all(color: FaseaColors.primary, width: 1.5),
  ),
  todayTextStyle: const TextStyle(
    color: FaseaColors.primary,
    fontWeight: FontWeight.w600,
  ),
  selectedTextStyle: const TextStyle(
    color: FaseaColors.onPrimary,
    fontWeight: FontWeight.w600,
  ),
);

HeaderStyle buildFaseaCalendarHeaderStyle() => const HeaderStyle(
  titleCentered: true,
  formatButtonVisible: false,
  titleTextStyle: TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w600,
    color: FaseaColors.tertiary,
  ),
  leftChevronIcon: Icon(Icons.chevron_left, color: FaseaColors.secondary),
  rightChevronIcon: Icon(Icons.chevron_right, color: FaseaColors.secondary),
);

DaysOfWeekStyle buildFaseaDaysOfWeekStyle() => const DaysOfWeekStyle(
  weekdayStyle: TextStyle(
    color: FaseaColors.secondary,
    fontWeight: FontWeight.w500,
    fontSize: 12,
  ),
  weekendStyle: TextStyle(
    color: FaseaColors.secondary,
    fontWeight: FontWeight.w500,
    fontSize: 12,
  ),
);

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
    fontFamily: FaseaFonts.sans,
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
      height: 72,
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
    filledButtonTheme: FilledButtonThemeData(style: FaseaButtons.filled()),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: FaseaColors.surface,
      floatingLabelBehavior: FloatingLabelBehavior.always,
      labelStyle: const TextStyle(
        color: FaseaColors.secondary,
        fontSize: 13,
        fontWeight: FontWeight.w500,
      ),
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
    outlinedButtonTheme: OutlinedButtonThemeData(style: FaseaButtons.outlined()),
    textButtonTheme: TextButtonThemeData(style: FaseaButtons.text()),
    chipTheme: ChipThemeData(
      backgroundColor: FaseaColors.surface,
      selectedColor: FaseaColors.tonalButton,
      disabledColor: FaseaColors.surfaceMuted,
      labelStyle: const TextStyle(
        fontFamily: FaseaFonts.sans,
        color: FaseaColors.tertiary,
        fontSize: 14,
      ),
      secondaryLabelStyle: const TextStyle(color: FaseaColors.tertiary),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      side: const BorderSide(color: FaseaColors.border),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(FaseaRadii.lg * 2),
      ),
      showCheckmark: false,
    ),
    segmentedButtonTheme: SegmentedButtonThemeData(
      style: ButtonStyle(
        minimumSize: WidgetStateProperty.all(FaseaButtons.minimumSize),
        padding: WidgetStateProperty.all(
          const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        ),
        textStyle: WidgetStateProperty.all(FaseaButtons.labelStyle),
        backgroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return FaseaColors.tonalButton;
          }
          return FaseaColors.surface;
        }),
        foregroundColor: WidgetStateProperty.resolveWith((states) {
          if (states.contains(WidgetState.selected)) {
            return FaseaColors.tertiary;
          }
          return FaseaColors.secondary;
        }),
        side: WidgetStateProperty.all(
          const BorderSide(color: FaseaColors.border),
        ),
        shape: WidgetStateProperty.all(
          RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(FaseaRadii.md),
          ),
        ),
      ),
    ),
    textTheme: const TextTheme(
      headlineMedium: TextStyle(
        fontFamily: FaseaFonts.sans,
        fontSize: 22,
        fontWeight: FontWeight.w600,
        height: 1.25,
        color: FaseaColors.tertiary,
      ),
      titleLarge: TextStyle(
        fontFamily: FaseaFonts.sans,
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
