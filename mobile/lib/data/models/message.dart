import '../../core/constants.dart';
import 'user.dart';

class Message {
  final String id;
  final dynamic sender; // String (userId) or User object
  final String? receiver;
  final String? groupId;
  final String content;
  final String type; // 'text', 'image', 'system'
  final String createdAt;
  final bool mentionAssistant;
  final List<String>? images;

  Message({
    required this.id,
    required this.sender,
    this.receiver,
    this.groupId,
    required this.content,
    this.type = 'text',
    required this.createdAt,
    this.mentionAssistant = false,
    this.images,
  });

  String get senderId => _normalizedSenderId(sender);

  User? get senderUser => sender is User ? sender as User : null;

  bool get isAiAssistant => senderId == AppConstants.aiAssistantId;

  bool get isTemporaryGroupAiMessage => id.startsWith('group-ai-');

  factory Message.fromJson(Map<String, dynamic> json) {
    final senderData = _normalizeSender(json['sender']);
    return Message(
      id: json['_id'] as String,
      sender: senderData is Map<String, dynamic>
          ? User.fromJson(senderData)
          : senderData as String? ?? 'unknown',
      receiver: json['receiver'] as String?,
      groupId: json['groupId'] as String?,
      content: json['content'] as String? ?? '',
      type: json['type'] as String? ?? 'text',
      createdAt: json['createdAt'] as String? ?? '',
      mentionAssistant: json['mentionAssistant'] as bool? ?? false,
      images:
          (json['images'] as List<dynamic>?)?.map((e) => e as String).toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'sender': sender is User ? (sender as User).toJson() : sender,
      'receiver': receiver,
      'groupId': groupId,
      'content': content,
      'type': type,
      'createdAt': createdAt,
      'mentionAssistant': mentionAssistant,
      if (images != null) 'images': images,
    };
  }
}

dynamic _normalizeSender(dynamic sender) {
  if (_isAssistantSender(sender)) {
    final username = _senderUsername(sender);
    final avatar = sender is Map<String, dynamic>
        ? sender['avatar'] as String? ?? ''
        : sender is User
            ? sender.avatar
            : '';
    return {
      '_id': AppConstants.aiAssistantId,
      'username':
          username.isEmpty || username == 'ai_assistant' ? '群聊小助手' : username,
      'avatar': avatar,
    };
  }
  return sender;
}

String _normalizedSenderId(dynamic sender) {
  if (_isAssistantSender(sender)) return AppConstants.aiAssistantId;
  if (sender is User) return sender.id;
  if (sender is Map<String, dynamic>) {
    return _stringValue(sender['_id'] ?? sender['id']);
  }
  return _stringValue(sender);
}

bool _isAssistantSender(dynamic sender) {
  final id = sender is User
      ? sender.id
      : sender is Map<String, dynamic>
          ? _stringValue(sender['_id'] ?? sender['id'])
          : _stringValue(sender);
  if (id == AppConstants.aiAssistantId || id == 'ai') return true;

  final username = _senderUsername(sender).trim().toLowerCase();
  return username == 'ai_assistant' || username == '群聊小助手' || username == '小助手';
}

String _senderUsername(dynamic sender) {
  if (sender is User) return sender.username;
  if (sender is Map<String, dynamic>) {
    return (sender['username'] ?? sender['name'] ?? '').toString();
  }
  return '';
}

String _stringValue(dynamic value) {
  if (value == null) return '';
  if (value is String) return value;
  if (value is Map<String, dynamic>) {
    return _stringValue(
      value[r'$oid'] ?? value['oid'] ?? value['_id'] ?? value['id'],
    );
  }
  return value.toString();
}
