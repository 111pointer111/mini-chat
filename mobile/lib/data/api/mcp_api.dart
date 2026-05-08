import 'package:dio/dio.dart';
import 'api_client.dart';

class MCPApi {
  final ApiClient _client;

  MCPApi(this._client);

  Future<Response> getServers() {
    return _client.dio.get('/mcp/servers');
  }

  Future<Response> createServer(Map<String, dynamic> data) {
    return _client.dio.post('/mcp/servers', data: data);
  }

  Future<Response> updateServer(String id, Map<String, dynamic> data) {
    return _client.dio.put('/mcp/servers/$id', data: data);
  }

  Future<Response> deleteServer(String id) {
    return _client.dio.delete('/mcp/servers/$id');
  }

  Future<Response> testServer(String id) {
    return _client.dio.post('/mcp/servers/$id/test');
  }

  Future<Response> refreshTools(String id) {
    return _client.dio.post('/mcp/servers/$id/refresh-tools');
  }

  Future<Response> getTools() {
    return _client.dio.get('/mcp/tools');
  }
}
