import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

/// Official multicolor Google "G" (Sign in with Google brand asset).
class GoogleLogoIcon extends StatelessWidget {
  const GoogleLogoIcon({super.key, this.size = 20});

  final double size;

  @override
  Widget build(BuildContext context) {
    return SvgPicture.asset(
      'assets/icons/google_logo.svg',
      width: size,
      height: size,
      semanticsLabel: 'Google',
    );
  }
}
