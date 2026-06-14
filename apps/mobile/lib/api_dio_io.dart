import 'package:cookie_jar/cookie_jar.dart';
import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:path_provider/path_provider.dart';

Future<Dio> createApiDio(String baseUrl) async {
  final dir = await getApplicationSupportDirectory();
  final jar = PersistCookieJar(
    storage: FileStorage('${dir.path}/cookies'),
    ignoreExpires: true,
  );
  final dio = Dio(BaseOptions(baseUrl: baseUrl));
  dio.interceptors.add(CookieManager(jar));
  return dio;
}
