import 'package:dio/dio.dart';
import 'api_client.dart';

class AIChatApi {
  final ApiClient _client;

  AIChatApi(this._client);

  Future<Response> sendMessage(String message, {List<String>? images, String? conversationId}) {
    return _client.dio.post('/ai-chat', data: {
      'message': message,
      if (images != null && images.isNotEmpty) 'images': images,
      if (conversationId != null) 'conversationId': conversationId,
    });
  }

  Future<Response> getConversations() {
    return _client.dio.get('/ai-chat/conversations');
  }

  Future<Response> createConversation() {
    return _client.dio.post('/ai-chat/conversations');
  }

  Future<Response> renameConversation(String id, String name) {
    return _client.dio.put('/ai-chat/conversations/$id', data: {'name': name});
  }

  Future<Response> deleteConversation(String id) {
    return _client.dio.delete('/ai-chat/conversations/$id');
  }

  Future<Response> getHistory({String? convId}) {
    final path = convId != null ? '/ai-chat/history/$convId' : '/ai-chat/history';
    return _client.dio.get(path);
  }
}
