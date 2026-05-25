import 'package:dio/dio.dart';
import 'api_client.dart';

class UploadApi {
  final ApiClient _client;

  UploadApi(this._client);

  Future<Response> uploadImages(List<MultipartFile> files) {
    final formData = FormData.fromMap({'images': files});
    return _client.dio.post('/upload/images', data: formData);
  }

  Future<Response> uploadImage(MultipartFile file) {
    final formData = FormData.fromMap({'image': file});
    return _client.dio.post('/upload/image', data: formData);
  }
}
