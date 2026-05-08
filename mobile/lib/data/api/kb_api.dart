import 'package:dio/dio.dart';
import 'api_client.dart';

class KBApi {
  final ApiClient _client;

  KBApi(this._client);

  Future<Response> getDocuments({int page = 1, int pageSize = 20}) {
    return _client.dio
        .get('/kb/documents', queryParameters: {'page': page, 'pageSize': pageSize});
  }

  Future<Response> getDocument(int id) {
    return _client.dio.get('/kb/documents/$id');
  }

  Future<Response> deleteDocument(int id) {
    return _client.dio.delete('/kb/documents/$id');
  }

  Future<Response> uploadDocument(FormData formData) {
    return _client.dio.post('/kb/documents/upload', data: formData);
  }

  Future<Response> importFromUrl(String url, {String? title}) {
    return _client.dio.post('/kb/documents/url', data: {
      'url': url,
      if (title != null) 'title': title,
    });
  }

  Future<Response> search(String q) {
    return _client.dio.get('/kb/search', queryParameters: {'q': q});
  }
}
