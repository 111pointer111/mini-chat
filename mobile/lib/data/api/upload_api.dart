import 'package:dio/dio.dart';
import 'api_client.dart';

class UploadedImage {
  final String url;
  final String base64;
  final String filename;
  final String originalName;
  final int size;

  const UploadedImage({
    required this.url,
    this.base64 = '',
    this.filename = '',
    this.originalName = '',
    this.size = 0,
  });

  factory UploadedImage.fromJson(Map<String, dynamic> json) {
    return UploadedImage(
      url: json['url'] as String? ?? '',
      base64: json['base64'] as String? ?? '',
      filename: json['filename'] as String? ?? '',
      originalName: json['originalName'] as String? ?? '',
      size: json['size'] is num ? (json['size'] as num).toInt() : 0,
    );
  }
}

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

  Future<List<UploadedImage>> uploadImageFiles(
      List<MultipartFile> files) async {
    final response = await uploadImages(files);
    final data = response.data;
    if (data is! Map<String, dynamic>) {
      throw const FormatException('Invalid upload response');
    }

    final images = data['images'];
    if (images is! List) {
      throw const FormatException('Invalid upload images response');
    }

    return images
        .whereType<Map<String, dynamic>>()
        .map(UploadedImage.fromJson)
        .where((image) => image.url.isNotEmpty)
        .toList();
  }

  Future<UploadedImage> uploadImageFile(MultipartFile file) async {
    final response = await uploadImage(file);
    final data = response.data;
    if (data is! Map<String, dynamic>) {
      throw const FormatException('Invalid upload response');
    }

    final image = UploadedImage.fromJson(data);
    if (image.url.isEmpty) {
      throw const FormatException('Invalid upload image response');
    }
    return image;
  }
}
