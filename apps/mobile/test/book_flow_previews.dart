import 'package:flutter/material.dart';
import 'package:fasea/fasea_design_system.dart';
import 'package:fasea/main.dart';
import 'package:table_calendar/table_calendar.dart';

enum BookFlowPreviewStep { pick, confirm, success }
enum BookFlowPreviewPickSlide { classSlide, date, time }

/// Static booking-step frames for golden tests (calendar tap is flaky in widget tests).
Widget bookFlowPreview({
  required BookFlowPreviewStep step,
  bool slotSelected = false,
  BookFlowPreviewPickSlide pickSlide = BookFlowPreviewPickSlide.time,
}) {
  if (step == BookFlowPreviewStep.success) {
    return _bookSuccessPreview();
  }
  if (step == BookFlowPreviewStep.confirm) {
    return _bookConfirmPreview();
  }
  return _bookPickPreview(
    slotSelected: slotSelected,
    pickSlide: pickSlide,
  );
}

Widget _previewPickSlideIndicator(int active) {
  const labels = ['Class', 'Date', 'Time'];
  return Row(
    mainAxisAlignment: MainAxisAlignment.center,
    children: [
      for (var i = 0; i < labels.length; i++) ...[
        if (i > 0) const SizedBox(width: FaseaSpacing.sm),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: i == active ? FaseaColors.primary : FaseaColors.border,
              ),
            ),
            const SizedBox(width: FaseaSpacing.xs),
            Text(
              labels[i],
              style: TextStyle(
                fontSize: 12,
                color: i == active ? FaseaColors.primary : FaseaColors.secondary,
                fontWeight: i == active ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ],
    ],
  );
}

Widget _bookPickPreview({
  required bool slotSelected,
  required BookFlowPreviewPickSlide pickSlide,
}) {
  final focused = DateTime(2026, 6, 13);
  return ListView(
    padding: FaseaSpacing.screenPadding(),
    children: [
      Text('Book a class', style: buildFaseaTheme().textTheme.headlineMedium),
      const SizedBox(height: FaseaSpacing.afterHeadline),
      FaseaCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _previewStepIndicator(0),
            const SizedBox(height: FaseaSpacing.sm),
            _previewPickSlideIndicator(pickSlide.index),
            const SizedBox(height: FaseaSpacing.md),
            if (pickSlide == BookFlowPreviewPickSlide.classSlide) ...[
              Text('Choose a class', style: buildFaseaTheme().textTheme.titleLarge),
              const SizedBox(height: FaseaSpacing.afterSectionTitle),
              _previewClassCard('Reformer Private', '1:1 session', selected: false),
              _previewClassCard('Group Mat', 'Small group', selected: false),
            ],
            if (pickSlide == BookFlowPreviewPickSlide.date) ...[
              Text('Pick a date', style: buildFaseaTheme().textTheme.titleLarge),
              const SizedBox(height: FaseaSpacing.xs),
              Text('Reformer Private', style: buildFaseaTheme().textTheme.bodySmall),
              const SizedBox(height: FaseaSpacing.sm),
              TableCalendar(
                firstDay: DateTime(2026, 6, 1),
                lastDay: DateTime(2026, 6, 30),
                focusedDay: focused,
                calendarStyle: buildFaseaCalendarStyle(),
                headerStyle: buildFaseaCalendarHeaderStyle(),
                daysOfWeekStyle: buildFaseaDaysOfWeekStyle(),
                selectedDayPredicate: (d) => isSameDay(d, focused),
                onDaySelected: (_, _) {},
                onPageChanged: (_) {},
              ),
            ],
            if (pickSlide == BookFlowPreviewPickSlide.time) ...[
              Text('Available times', style: buildFaseaTheme().textTheme.titleLarge),
              const SizedBox(height: FaseaSpacing.xs),
              Text('Reformer Private · Jun 13, 2026', style: buildFaseaTheme().textTheme.bodySmall),
              const SizedBox(height: FaseaSpacing.afterSectionTitle),
              Container(
                decoration: BoxDecoration(
                  border: Border.all(color: FaseaColors.border),
                  borderRadius: BorderRadius.circular(FaseaRadii.md),
                ),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: FaseaSpacing.sm,
                    vertical: FaseaSpacing.xs,
                  ),
                  child: ListTile(
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: FaseaSpacing.md,
                      vertical: FaseaSpacing.sm,
                    ),
                    selected: slotSelected,
                    selectedTileColor: Color(0x73DFD1C9),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(FaseaRadii.md),
                    ),
                    title: const Text('10:00 AM - 11:00 AM'),
                    subtitle: Text('2 spots left', style: buildFaseaTheme().textTheme.bodySmall),
                    trailing: slotSelected
                        ? const Icon(Icons.check_circle, color: FaseaColors.primary)
                        : null,
                  ),
                ),
              ),
              const SizedBox(height: FaseaSpacing.md),
              FilledButton(
                onPressed: slotSelected ? () {} : null,
                child: const Text('Review booking'),
              ),
            ],
          ],
        ),
      ),
    ],
  );
}

Widget _previewClassCard(String title, String subtitle, {required bool selected}) {
  return Padding(
    padding: const EdgeInsets.only(bottom: FaseaSpacing.sm),
    child: Container(
      padding: const EdgeInsets.all(FaseaSpacing.md),
      decoration: BoxDecoration(
        color: selected ? Color(0x73DFD1C9) : FaseaColors.surface,
        borderRadius: BorderRadius.circular(FaseaRadii.md),
        border: Border.all(color: FaseaColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: buildFaseaTheme().textTheme.titleLarge),
          const SizedBox(height: FaseaSpacing.xs),
          Text(subtitle, style: buildFaseaTheme().textTheme.bodySmall),
        ],
      ),
    ),
  );
}

Widget _bookConfirmPreview() {
  return ListView(
    padding: FaseaSpacing.screenPadding(),
    children: [
      Text('Book a class', style: buildFaseaTheme().textTheme.headlineMedium),
      const SizedBox(height: FaseaSpacing.afterHeadline),
      FaseaCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _previewStepIndicator(1),
            const SizedBox(height: FaseaSpacing.md),
            Text('Review your booking', style: buildFaseaTheme().textTheme.titleLarge),
            const SizedBox(height: FaseaSpacing.afterSectionTitle),
            const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Class', style: TextStyle(color: FaseaColors.secondary, fontSize: 12)),
                Text('Reformer Private', style: TextStyle(fontWeight: FontWeight.w600)),
                SizedBox(height: FaseaSpacing.sm),
                Text('Date', style: TextStyle(color: FaseaColors.secondary, fontSize: 12)),
                Text('Jun 13, 2026', style: TextStyle(fontWeight: FontWeight.w600)),
                SizedBox(height: FaseaSpacing.sm),
                Text('Time', style: TextStyle(color: FaseaColors.secondary, fontSize: 12)),
                Text('10:00 AM – 11:00 AM', style: TextStyle(fontWeight: FontWeight.w600)),
                SizedBox(height: FaseaSpacing.sm),
                Text(
                  'We will send booking updates to your WhatsApp and email.',
                  style: TextStyle(color: FaseaColors.secondary, fontSize: 12),
                ),
              ],
            ),
            const SizedBox(height: FaseaSpacing.md),
            FilledButton(
              onPressed: () {},
              style: ButtonStyle(
                backgroundColor: WidgetStatePropertyAll(FaseaColors.primary),
                foregroundColor: WidgetStatePropertyAll(FaseaColors.onPrimary),
              ),
              child: const Text('Confirm booking'),
            ),
          ],
        ),
      ),
    ],
  );
}

Widget _bookSuccessPreview() {
  return ListView(
    padding: FaseaSpacing.screenPadding(),
    children: [
      Text('Book a class', style: buildFaseaTheme().textTheme.headlineMedium),
      const SizedBox(height: FaseaSpacing.afterHeadline),
      FaseaCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            _previewStepIndicator(2),
            const SizedBox(height: FaseaSpacing.md),
            const Column(
              children: [
                Icon(Icons.check_circle, color: FaseaColors.primary, size: 48),
                SizedBox(height: FaseaSpacing.md),
                Text("You're booked", style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700)),
                SizedBox(height: FaseaSpacing.sm),
                Text(
                  'FASEA-7K2M',
                  style: TextStyle(
                    fontFamily: FaseaFonts.serif,
                    fontSize: 32,
                    fontWeight: FontWeight.w700,
                    color: FaseaColors.primary,
                  ),
                ),
              ],
            ),
            SizedBox(height: FaseaSpacing.md),
            FilledButton(onPressed: () {}, child: const Text('Book another class')),
          ],
        ),
      ),
    ],
  );
}

Widget _previewStepIndicator(int active) {
  const labels = ['Choose', 'Confirm', 'Done'];
  return Row(
    mainAxisAlignment: MainAxisAlignment.spaceBetween,
    children: [
      for (var i = 0; i < labels.length; i++)
        Column(
          children: [
            CircleAvatar(
              radius: 12,
              backgroundColor:
                  i <= active ? FaseaColors.primary : FaseaColors.border,
              child: Text(
                '${i + 1}',
                style: TextStyle(
                  fontSize: 12,
                  color: i <= active ? FaseaColors.onPrimary : FaseaColors.secondary,
                ),
              ),
            ),
            const SizedBox(height: FaseaSpacing.xs),
            Text(
              labels[i],
              style: TextStyle(
                fontSize: 12,
                color: i == active ? FaseaColors.primary : FaseaColors.secondary,
                fontWeight: i == active ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ],
        ),
    ],
  );
}

Widget accountLookupPreview() {
  return ListView(
    padding: FaseaSpacing.screenPadding(),
    children: [
      Text('Account', style: buildFaseaTheme().textTheme.headlineMedium),
      const SizedBox(height: FaseaSpacing.afterHeadline),
      FaseaCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Booking check Results',
              style: buildFaseaTheme().textTheme.titleLarge,
            ),
            const SizedBox(height: FaseaSpacing.xs),
            ListTile(
              contentPadding: EdgeInsets.zero,
              title: const Text('Reformer Private · FASEA-7K2M'),
              subtitle: Text(
                '2026-06-20 10:00 AM · confirmed',
                style: buildFaseaTheme().textTheme.bodySmall,
              ),
              trailing: TextButton(
                onPressed: () {},
                child: const Text('Cancel'),
              ),
            ),
          ],
        ),
      ),
    ],
  );
}