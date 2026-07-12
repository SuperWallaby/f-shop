import 'package:dio/dio.dart';
import 'package:fasea/main.dart';

/// Deterministic API for flow golden tests (no network).
class FlowMockApi extends ApiClient {
  FlowMockApi({this.bookingCode = 'FASEA-7K2M'}) : super(Dio(BaseOptions(baseUrl: 'http://localhost:4819')));

  final String bookingCode;

  static final _items = [
    ClassItem.fromJson({
      'id': 'item-reformer',
      'name': 'Reformer Private',
      'description': '1:1 session',
    }),
    ClassItem.fromJson({
      'id': 'item-mat',
      'name': 'Group Mat',
      'description': 'Small group',
    }),
  ];

  static List<Plan> get samplePlans => [
    Plan.fromJson({
      'id': 'p1',
      'code': 'mat5',
      'title': 'Group Mat · 5 classes',
      'cardTitle': '5-Class Mat Pack',
      'category': 'group_mat',
      'sortOrder': 1,
      'classCount': 5,
      'priceRm': 280,
      'studentPriceRm': 250,
      'validityDays': 60,
      'active': true,
    }),
    Plan.fromJson({
      'id': 'p2',
      'code': 'ref3',
      'title': 'Reformer · 3 classes',
      'cardTitle': '3-Class Reformer',
      'category': 'reformer_private',
      'sortOrder': 2,
      'classCount': 3,
      'priceRm': 450,
      'validityDays': 45,
      'active': true,
    }),
  ];

  static final _events = [
    FaseaEvent.fromJson({
      'id': 'e1',
      'title': 'Summer Workshop',
      'summary': 'A calm afternoon session for all levels.',
      'startsAt': '2026-07-15T10:00:00.000Z',
      'location': 'Faséa Studio, KL',
      'priceLabel': 'RM 45',
      'active': true,
      'sortOrder': 1,
    }),
  ];

  static final _lookup = BookingLookup.fromJson({
    'code': 'FASEA-7K2M',
    'status': 'confirmed',
    'dateKey': '2026-06-20',
    'startMin': 600,
    'endMin': 660,
    'className': 'Reformer Private',
  });

  @override
  Future<List<ClassItem>> items() async => _items;

  @override
  Future<List<String>> availableDates(
    String from,
    String to,
    String itemId,
  ) async {
    final today = DateTime.now();
    return [
      dateKey(today),
      dateKey(today.add(const Duration(days: 2))),
      dateKey(today.add(const Duration(days: 5))),
    ];
  }

  @override
  Future<List<Slot>> slots(String dateKey, String itemId) async => [
    Slot.fromJson({
      'id': 'slot-1',
      'dateKey': dateKey,
      'startMin': 600,
      'endMin': 660,
      'available': 2,
      'isFull': false,
    }),
    Slot.fromJson({
      'id': 'slot-2',
      'dateKey': dateKey,
      'startMin': 720,
      'endMin': 780,
      'available': 1,
      'isFull': false,
    }),
  ];

  @override
  Future<String> book({
    required String slotId,
    required String name,
    required String email,
    required String whatsapp,
  }) async => bookingCode;

  @override
  Future<List<Plan>> plans() async => samplePlans;

  @override
  Future<List<Plan>> adminPlans() async => samplePlans;

  @override
  Future<List<FaseaEvent>> events({bool admin = false}) async => _events;

  @override
  Future<List<BookingLookup>> lookupBookings({
    String? code,
    String? name,
    String? email,
    String? whatsapp,
  }) async => [_lookup];

  @override
  Future<List<BookingLookup>> myBookings() async => [_lookup];

  @override
  Future<String> createOrder(String planId) async =>
      'https://wa.me/60145403560?text=plan';
}

ClientMe flowSampleMe({int balance = 3}) => ClientMe(
  authed: true,
  client: Client.fromJson({
    'id': '1',
    'name': 'Minjae Kim',
    'email': 'minjae@fasea.test',
    'whatsapp': '+60123456789',
    'studentStatus': 'verified',
  }),
  balance: Balance.fromJson({
    'balance': balance,
    'expiringCredits': balance > 0
        ? [
            {'amount': 1, 'expiresAt': '2026-08-01T00:00:00.000Z'},
          ]
        : [],
  }),
);
