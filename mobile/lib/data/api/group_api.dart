import 'package:dio/dio.dart';
import 'api_client.dart';

class GroupApi {
  final ApiClient _client;

  GroupApi(this._client);

  Future<Response> getGroups() {
    return _client.dio.get('/groups');
  }

  Future<Response> createGroup(String name, List<String> memberIds) {
    return _client.dio.post('/groups', data: {
      'name': name,
      'memberIds': memberIds,
    });
  }

  Future<Response> getGroupMessages(String groupId, {String? before, int limit = 50}) {
    return _client.dio.get('/groups/$groupId/messages', queryParameters: {
      'limit': limit,
      if (before != null) 'before': before,
    });
  }

  Future<Response> getGroupMembers(String groupId) {
    return _client.dio.get('/groups/$groupId/members');
  }

  Future<Response> addGroupMembers(String groupId, List<String> memberIds) {
    return _client.dio.post('/groups/$groupId/members', data: {
      'memberIds': memberIds,
    });
  }

  // Group KB
  Future<Response> getGroupKBDocuments(String groupId, {int page = 1, int pageSize = 20}) {
    return _client.dio.get('/groups/$groupId/kb/documents',
        queryParameters: {'page': page, 'pageSize': pageSize});
  }

  Future<Response> uploadGroupKBDocument(String groupId, FormData formData) {
    return _client.dio.post('/groups/$groupId/kb/documents/upload',
        data: formData);
  }

  Future<Response> importGroupKBFromUrl(String groupId, String url, {String? title}) {
    return _client.dio.post('/groups/$groupId/kb/documents/url', data: {
      'url': url,
      if (title != null) 'title': title,
    });
  }

  Future<Response> deleteGroupKBDocument(String groupId, int documentId) {
    return _client.dio.delete('/groups/$groupId/kb/documents/$documentId');
  }
}
