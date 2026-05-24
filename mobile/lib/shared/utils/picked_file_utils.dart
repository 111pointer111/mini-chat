import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';

Future<MultipartFile> multipartFileFromPickedFile(PlatformFile file) {
  final path = file.path;
  if (path != null && path.isNotEmpty) {
    return MultipartFile.fromFile(path, filename: file.name);
  }

  final bytes = file.bytes;
  if (bytes != null) {
    return Future.value(MultipartFile.fromBytes(bytes, filename: file.name));
  }

  throw StateError('无法读取文件内容，请重新选择文件后再试');
}
