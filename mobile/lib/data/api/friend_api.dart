import 'package:dio/dio.dart';
import 'api_client.dart';

class FriendApi {
  final ApiClient _client;

  FriendApi(this._client);

  Future<Response> getFriends() {
    return _client.dio.get('/friends');
  }

  Future<Response> getPendingRequests() {
    return _client.dio.get('/friends/requests/pending');
  }

  Future<Response> sendRequest(String recipientId) {
    return _client.dio.post('/friends/request', data: {
      'recipientId': recipientId,
    });
  }

  Future<Response> acceptRequest(String requestId) {
    return _client.dio.put('/friends/request/$requestId/accept');
  }
}
