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

  String get senderId {
    if (sender is User) return (sender as User).id;
    return sender as String;
  }

  User? get senderUser => sender is User ? sender as User : null;

  factory Message.fromJson(Map<String, dynamic> json) {
    final senderData = json['sender'];
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
      images: (json['images'] as List<dynamic>?)
          ?.map((e) => e as String)
          .toList(),
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
