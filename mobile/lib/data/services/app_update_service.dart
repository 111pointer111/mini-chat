import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';

import '../../core/constants.dart';

final appUpdateServiceProvider = Provider<AppUpdateService>((ref) {
  return AppUpdateService(
    Dio(
      BaseOptions(
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(minutes: 3),
      ),
    ),
  );
});

class AppUpdateInfo {
  final int latestVersionCode;
  final String latestVersionName;
  final String apkUrl;
  final String releaseNotes;
  final bool forceUpdate;

  const AppUpdateInfo({
    required this.latestVersionCode,
    required this.latestVersionName,
    required this.apkUrl,
    required this.releaseNotes,
    required this.forceUpdate,
  });

  factory AppUpdateInfo.fromJson(Map<String, dynamic> json) {
    return AppUpdateInfo(
      latestVersionCode: _readInt(json['latestVersionCode']),
      latestVersionName: (json['latestVersionName'] as String?) ?? '',
      apkUrl: (json['apkUrl'] as String?) ?? '',
      releaseNotes: (json['releaseNotes'] as String?) ?? '',
      forceUpdate: json['forceUpdate'] == true,
    );
  }

  static int _readInt(Object? value) {
    if (value is int) return value;
    if (value is String) return int.tryParse(value) ?? 0;
    return 0;
  }
}

class AppUpdateService {
  static const MethodChannel _channel =
      MethodChannel('com.minichat.mobile/app_update');

  final Dio _dio;

  AppUpdateService(this._dio);

  Future<AppUpdateInfo?> checkForUpdate() async {
    if (!Platform.isAndroid) return null;

    final response = await _dio.get<Map<String, dynamic>>(
      '${AppConstants.androidDownloadBaseUrl}/version.json',
      queryParameters: {'t': DateTime.now().millisecondsSinceEpoch},
    );
    final data = response.data;
    if (data == null) return null;

    final update = AppUpdateInfo.fromJson(data);
    if (update.latestVersionCode <= 0 || update.apkUrl.isEmpty) return null;

    final currentVersionCode = await _readCurrentVersionCode();

    return update.latestVersionCode > currentVersionCode ? update : null;
  }

  Future<String> downloadApk(
    AppUpdateInfo update, {
    required ProgressCallback onProgress,
  }) async {
    final cacheDir = await getTemporaryDirectory();
    final apkName = Uri.tryParse(update.apkUrl)?.pathSegments.last;
    final fileName = (apkName == null || apkName.isEmpty)
        ? 'mini-chat-${update.latestVersionName}+${update.latestVersionCode}.apk'
        : apkName;
    final apkPath = '${cacheDir.path}/$fileName';

    await _dio.download(
      update.apkUrl,
      apkPath,
      deleteOnError: true,
      onReceiveProgress: onProgress,
    );

    return apkPath;
  }

  Future<bool> installApk(String apkPath) async {
    if (!Platform.isAndroid) return false;
    final openedInstaller = await _channel.invokeMethod<bool>(
      'installApk',
      {'path': apkPath},
    );
    return openedInstaller ?? false;
  }

  Future<int> _readCurrentVersionCode() async {
    final versionCode = await _channel.invokeMethod<Object>('getVersionCode');
    if (versionCode is int) return versionCode;
    if (versionCode is num) return versionCode.toInt();
    return 0;
  }
}
