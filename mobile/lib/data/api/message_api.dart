import 'package:dio/dio.dart';
import 'api_client.dart';

class MessageApi {
  final ApiClient _client;

  MessageApi(this._client);

  Future<Response> getMessages(String friendId, {String? before, int limit = 50}) {
    return _client.dio.get('/messages/$friendId', queryParameters: {
      'limit': limit,
      if (before != null) 'before': before,
    });
  }
}
