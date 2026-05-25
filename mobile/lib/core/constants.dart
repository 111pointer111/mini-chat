class AppConstants {
  // 通过 --dart-define 注入，支持不同环境：
  // flutter run --dart-define=API_HOST=192.168.1.100:5000
  // flutter build apk --dart-define=API_HOST=mini-chat.cn
  static const String _apiHost = String.fromEnvironment(
    'API_HOST',
    defaultValue: 'mini-chat.cn',
  );
  static const bool _useHttps = bool.fromEnvironment(
    'USE_HTTPS',
    defaultValue: true,
  );
  static const String _androidDownloadBaseUrl = String.fromEnvironment(
    'ANDROID_DOWNLOAD_BASE_URL',
    defaultValue: '',
  );

  static String get _scheme => _useHttps ? 'https' : 'http';
  static String get apiBaseUrl => '$_scheme://$_apiHost/api';
  static String get socketUrl => '$_scheme://$_apiHost';
  static String get uploadsBaseUrl => '$_scheme://$_apiHost';
  static String get androidDownloadBaseUrl => _androidDownloadBaseUrl.isNotEmpty
      ? _androidDownloadBaseUrl
      : '$uploadsBaseUrl/downloads';

  static String resolveFileUrl(String url) {
    if (url.isEmpty) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return '$uploadsBaseUrl$url';
    return '$uploadsBaseUrl/$url';
  }

  // AI assistant fixed ObjectId
  static const String aiAssistantId = '000000000000000000000001';

  // Storage keys
  static const String tokenKey = 'auth_token';
  static const String userKey = 'current_user';
}
