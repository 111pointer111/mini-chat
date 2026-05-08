class AppConstants {
  static const String apiBaseUrl = 'http://mini-chat.cn:5000/api';
  static const String socketUrl = 'http://mini-chat.cn:5000';
  static const String uploadsBaseUrl = 'http://mini-chat.cn:5000';

  // AI assistant fixed ObjectId
  static const String aiAssistantId = '000000000000000000000001';

  // Storage keys
  static const String tokenKey = 'auth_token';
  static const String userKey = 'current_user';

  // Polling intervals
  static const Duration friendListPollInterval = Duration(seconds: 10);
}
