import 'package:dio/dio.dart';
import 'api_client.dart';

class MessageApi {
  final ApiClient _client;

  MessageApi(this._client);

  Future<Response> getMessages(String friendId) {
    return _client.dio.get('/messages/$friendId');
  }
}
