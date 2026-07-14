import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import 'fasea_design_system.dart';

Map<String, dynamic> _asMap(dynamic value) =>
    Map<String, dynamic>.from(value as Map);
List<dynamic> _asList(dynamic value) =>
    List<dynamic>.from(value as List? ?? const []);

String _dateKey(DateTime date) => DateFormat('yyyy-MM-dd').format(
  DateTime(date.year, date.month, date.day),
);

String _timeLabel(int minutes) => DateFormat.jm().format(
  DateTime(2024, 1, 1, minutes ~/ 60, minutes % 60),
);

typedef ScheduleLoader = Future<PublicScheduleData> Function({
  required String fromDateKey,
  required String toDateKey,
  String? itemId,
});

class ScheduleItem {
  ScheduleItem.fromJson(Map<String, dynamic> json)
    : id = '${json['id']}',
      name = '${json['name'] ?? ''}',
      color = '${json['color'] ?? ''}';
  final String id, name, color;
}

class ScheduleSlot {
  ScheduleSlot.fromJson(Map<String, dynamic> json)
    : id = '${json['id']}',
      itemId = '${json['itemId']}',
      itemName = '${json['itemName'] ?? ''}',
      itemColor = '${json['itemColor'] ?? ''}',
      startMin = json['startMin'] as int? ?? 0,
      endMin = json['endMin'] as int? ?? 0,
      capacity = json['capacity'] as int? ?? 1,
      bookedCount = json['bookedCount'] as int? ?? 0,
      available = json['available'] as int? ?? 0;
  final String id, itemId, itemName, itemColor;
  final int startMin, endMin, capacity, bookedCount, available;

  String get timeRange =>
      '${_timeLabel(startMin)} – ${_timeLabel(endMin)}';

  String get spotsLabel {
    if (capacity <= 1) return available > 0 ? 'Open' : 'Full';
    return '$bookedCount/$capacity booked';
  }
}

class ScheduleDay {
  ScheduleDay.fromJson(Map<String, dynamic> json)
    : dateKey = '${json['dateKey']}',
      slots = _asList(json['slots'])
          .map((e) => ScheduleSlot.fromJson(_asMap(e)))
          .toList();
  final String dateKey;
  final List<ScheduleSlot> slots;
}

class PublicScheduleData {
  PublicScheduleData.fromJson(Map<String, dynamic> json)
    : fromDateKey = '${json['fromDateKey']}',
      toDateKey = '${json['toDateKey']}',
      items = _asList(json['items'])
          .map((e) => ScheduleItem.fromJson(_asMap(e)))
          .toList(),
      days = _asList(json['days'])
          .map((e) => ScheduleDay.fromJson(_asMap(e)))
          .toList();
  final String fromDateKey, toDateKey;
  final List<ScheduleItem> items;
  final List<ScheduleDay> days;
}

Color? parseItemColor(String raw) {
  final hex = raw.trim();
  if (hex.isEmpty) return null;
  final normalized = hex.startsWith('#') ? hex.substring(1) : hex;
  if (normalized.length != 6 && normalized.length != 8) return null;
  final value = int.tryParse(normalized, radix: 16);
  if (value == null) return null;
  if (normalized.length == 6) return Color(0xFF000000 | value);
  return Color(value);
}

class ScheduleScreen extends StatefulWidget {
  const ScheduleScreen({super.key, required this.loadSchedule});
  final ScheduleLoader loadSchedule;

  @override
  State<ScheduleScreen> createState() => _ScheduleScreenState();
}

class _ScheduleScreenState extends State<ScheduleScreen> {
  late DateTime _month;
  String _filterItemId = '';
  bool _bookedOnly = false;
  String _selectedDateKey = _dateKey(DateTime.now());
  bool _loading = false;
  String? _error;
  PublicScheduleData? _data;

  @override
  void initState() {
    super.initState();
    _month = DateTime(DateTime.now().year, DateTime.now().month);
    _load();
  }

  String get _fromDateKey => _dateKey(DateTime(_month.year, _month.month, 1));

  String get _toDateKey {
    final last = DateTime(_month.year, _month.month + 1, 0);
    return _dateKey(last);
  }

  List<DateTime> get _monthDays {
    final last = DateTime(_month.year, _month.month + 1, 0);
    return List.generate(
      last.day,
      (i) => DateTime(_month.year, _month.month, i + 1),
    );
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await widget.loadSchedule(
        fromDateKey: _fromDateKey,
        toDateKey: _toDateKey,
        itemId: _filterItemId.isEmpty ? null : _filterItemId,
      );
      if (!mounted) return;
      final now = DateTime.now();
      final inMonth =
          now.year == _month.year && now.month == _month.month;
      setState(() {
        _data = data;
        _selectedDateKey = inMonth ? _dateKey(now) : _fromDateKey;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _error = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _changeMonth(int delta) {
    setState(() {
      _month = DateTime(_month.year, _month.month + delta);
    });
    _load();
  }

  Map<String, ScheduleDay> get _dayMap {
    final days = _data?.days ?? const <ScheduleDay>[];
    final filtered = _bookedOnly
        ? [
            for (final d in days)
              if (d.slots.any((s) => s.bookedCount > 0))
                ScheduleDay.fromJson({
                  'dateKey': d.dateKey,
                  'slots': d.slots
                      .where((s) => s.bookedCount > 0)
                      .map(
                        (s) => {
                          'id': s.id,
                          'itemId': s.itemId,
                          'itemName': s.itemName,
                          'itemColor': s.itemColor,
                          'startMin': s.startMin,
                          'endMin': s.endMin,
                          'capacity': s.capacity,
                          'bookedCount': s.bookedCount,
                          'available': s.available,
                        },
                      )
                      .toList(),
                }),
          ]
        : days;
    return {for (final d in filtered) d.dateKey: d};
  }

  @override
  Widget build(BuildContext context) {
    final todayKey = _dateKey(DateTime.now());
    final dayMap = _dayMap;
    final selectedSlots = dayMap[_selectedDateKey]?.slots ?? const [];
    final monthLabel = DateFormat.yMMMM().format(_month);

    return Scaffold(
      appBar: AppBar(
        title: const Text(
          'Class schedule',
          style: TextStyle(fontFamily: FaseaFonts.serif),
        ),
      ),
      body: ListView(
        padding: FaseaSpacing.screenPadding(embedded: true),
        children: [
          Text(
            'Monthly view by class type. Spots are for reference — book from the Book tab.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: FaseaColors.secondary,
            ),
          ),
          const SizedBox(height: FaseaSpacing.md),
          Wrap(
            spacing: FaseaSpacing.sm,
            runSpacing: FaseaSpacing.sm,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              _ClassFilter(
                items: _data?.items ?? const [],
                value: _filterItemId,
                onChanged: (v) {
                  setState(() => _filterItemId = v);
                  _load();
                },
              ),
              FilterChip(
                label: const Text('Booked only'),
                selected: _bookedOnly,
                onSelected: (v) => setState(() => _bookedOnly = v),
              ),
              OutlinedButton(
                onPressed: _loading ? null : () => _changeMonth(-1),
                child: const Text('Prev'),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: FaseaSpacing.md,
                  vertical: FaseaSpacing.sm,
                ),
                decoration: BoxDecoration(
                  border: Border.all(color: FaseaColors.border),
                  borderRadius: BorderRadius.circular(FaseaRadii.lg),
                  color: FaseaColors.surface.withValues(alpha: 0.8),
                ),
                child: Text(monthLabel),
              ),
              OutlinedButton(
                onPressed: _loading ? null : () => _changeMonth(1),
                child: const Text('Next'),
              ),
            ],
          ),
          if (_loading)
            const Padding(
              padding: EdgeInsets.only(top: FaseaSpacing.lg),
              child: Center(child: CircularProgressIndicator()),
            ),
          if (_error != null)
            Padding(
              padding: const EdgeInsets.only(top: FaseaSpacing.md),
              child: Text(
                _error!,
                style: const TextStyle(color: FaseaColors.error),
              ),
            ),
          if (!_loading && _error == null) ...[
            const SizedBox(height: FaseaSpacing.lg),
            SizedBox(
              height: 92,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _monthDays.length,
                separatorBuilder: (_, __) =>
                    const SizedBox(width: FaseaSpacing.sm),
                itemBuilder: (context, i) {
                  final dt = _monthDays[i];
                  final key = _dateKey(dt);
                  final slots = dayMap[key]?.slots ?? const [];
                  final selected = key == _selectedDateKey;
                  final isToday = key == todayKey;
                  return _DayChip(
                    weekday: DateFormat.E().format(dt),
                    day: dt.day,
                    sessionCount: slots.length,
                    selected: selected,
                    isToday: isToday,
                    onTap: () => setState(() => _selectedDateKey = key),
                  );
                },
              ),
            ),
            const SizedBox(height: FaseaSpacing.md),
            Container(
              width: double.infinity,
              margin: const EdgeInsets.symmetric(vertical: FaseaSpacing.sm),
              padding: const EdgeInsets.all(FaseaSpacing.gutter),
              decoration: BoxDecoration(
                color: FaseaColors.surface.withValues(alpha: 0.75),
                borderRadius: BorderRadius.circular(FaseaRadii.lg),
                border: Border.all(color: FaseaColors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _selectedDateKey,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontFamily: FaseaFonts.serif,
                    ),
                  ),
                  const SizedBox(height: FaseaSpacing.md),
                  if (selectedSlots.isEmpty)
                    Text(
                      'No sessions',
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: FaseaColors.secondary,
                      ),
                    )
                  else
                    for (var i = 0; i < selectedSlots.length; i++) ...[
                      if (i > 0) const SizedBox(height: FaseaSpacing.sm),
                      _ScheduleSlotCard(slot: selectedSlots[i]),
                    ],
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ClassFilter extends StatelessWidget {
  const _ClassFilter({
    required this.items,
    required this.value,
    required this.onChanged,
  });
  final List<ScheduleItem> items;
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: FaseaSpacing.sm),
      decoration: BoxDecoration(
        border: Border.all(color: FaseaColors.border),
        borderRadius: BorderRadius.circular(FaseaRadii.lg),
        color: FaseaColors.surface.withValues(alpha: 0.8),
      ),
      child: DropdownButtonHideUnderline(
        child: DropdownButton<String>(
          value: value.isEmpty ? '' : value,
          items: [
            const DropdownMenuItem(value: '', child: Text('All class types')),
            for (final it in items)
              DropdownMenuItem(value: it.id, child: Text(it.name)),
          ],
          onChanged: (v) => onChanged(v ?? ''),
        ),
      ),
    );
  }
}

class _DayChip extends StatelessWidget {
  const _DayChip({
    required this.weekday,
    required this.day,
    required this.sessionCount,
    required this.selected,
    required this.isToday,
    required this.onTap,
  });
  final String weekday;
  final int day;
  final int sessionCount;
  final bool selected;
  final bool isToday;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? FaseaColors.tonalButton : FaseaColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(FaseaRadii.md),
        side: BorderSide(
          color: selected ? FaseaColors.tonalButton : FaseaColors.border,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(FaseaRadii.md),
        child: Container(
          width: 72,
          padding: const EdgeInsets.all(FaseaSpacing.sm),
          decoration: isToday && !selected
              ? BoxDecoration(
                  borderRadius: BorderRadius.circular(FaseaRadii.md),
                  border: Border.all(color: FaseaColors.primary, width: 2),
                )
              : null,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                weekday,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: FaseaColors.secondary,
                  fontSize: 10,
                ),
              ),
              Text(
                '$day',
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                  height: 1,
                ),
              ),
              const SizedBox(height: FaseaSpacing.xs),
              Text(
                sessionCount > 0 ? '$sessionCount sessions' : '—',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: FaseaColors.secondary,
                  fontSize: 10,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ScheduleSlotCard extends StatelessWidget {
  const _ScheduleSlotCard({required this.slot});
  final ScheduleSlot slot;

  @override
  Widget build(BuildContext context) {
    final bg = parseItemColor(slot.itemColor);
    final full = slot.available <= 0;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        horizontal: 10,
        vertical: FaseaSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: bg ?? FaseaColors.surface,
        borderRadius: BorderRadius.circular(FaseaRadii.sm),
        border: bg == null ? Border.all(color: FaseaColors.border) : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            slot.timeRange,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
              fontWeight: FontWeight.w600,
              color: FaseaColors.tertiary,
            ),
          ),
          Text(
            slot.itemName,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: FaseaColors.tertiary.withValues(alpha: 0.9),
            ),
          ),
          const SizedBox(height: FaseaSpacing.xs),
          Text(
            slot.spotsLabel,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: full ? FaseaColors.secondary : FaseaColors.tertiary,
              fontWeight: full ? FontWeight.normal : FontWeight.w600,
              fontSize: 10,
            ),
          ),
        ],
      ),
    );
  }
}
