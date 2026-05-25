import 'package:dio/dio.dart';
import 'api_client.dart';

class UserApi {
  final ApiClient _client;

  UserApi(this._client);

  Future<Response> searchUsers(String query) {
    return _client.dio.get('/users/search', queryParameters: {'query': query});
  }

  Future<Response> updateMe({
    String? username,
    String? avatar,
  }) {
    return _client.dio.patch('/users/me', data: {
      if (username != null) 'username': username,
      if (avatar != null) 'avatar': avatar,
    });
  }
}
