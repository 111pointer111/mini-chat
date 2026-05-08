import 'package:dio/dio.dart';
import 'api_client.dart';

class AIProviderApi {
  final ApiClient _client;

  AIProviderApi(this._client);

  Future<Response> getProviders() {
    return _client.dio.get('/ai-providers');
  }

  Future<Response> getUserProvider() {
    return _client.dio.get('/ai-providers/user');
  }

  Future<Response> setUserProvider(String providerId) {
    return _client.dio.put('/ai-providers/user', data: {'providerId': providerId});
  }

  Future<Response> getAdminProviders() {
    return _client.dio.get('/ai-providers/admin');
  }

  Future<Response> createProvider(Map<String, dynamic> data) {
    return _client.dio.post('/ai-providers/admin', data: data);
  }

  Future<Response> updateProvider(String id, Map<String, dynamic> data) {
    return _client.dio.put('/ai-providers/admin/$id', data: data);
  }

  Future<Response> deleteProvider(String id) {
    return _client.dio.delete('/ai-providers/admin/$id');
  }
}
