import 'package:dio/dio.dart';

import 'api_dio_io.dart' if (dart.library.html) 'api_dio_web.dart' as impl;

Future<Dio> createApiDio(String baseUrl) => impl.createApiDio(baseUrl);
