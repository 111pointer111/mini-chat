import 'package:dio/dio.dart';
import 'api_client.dart';

class UserApi {
  final ApiClient _client;

  UserApi(this._client);

  Future<Response> searchUsers(String query) {
    return _client.dio.get('/users/search', queryParameters: {'query': query});
  }
}
