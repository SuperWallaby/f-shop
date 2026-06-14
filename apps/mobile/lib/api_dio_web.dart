import 'package:dio/dio.dart';
import 'package:dio/browser.dart';

Future<Dio> createApiDio(String baseUrl) async {
  final dio = Dio(
    BaseOptions(
      baseUrl: baseUrl,
      headers: const {'Accept': 'application/json'},
    ),
  );
  dio.httpClientAdapter = BrowserHttpClientAdapter(withCredentials: true);
  return dio;
}
