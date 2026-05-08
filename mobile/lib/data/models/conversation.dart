class Conversation {
  final String id;
  final String name;
  final String lastMessageAt;

  Conversation({
    required this.id,
    required this.name,
    required this.lastMessageAt,
  });

  factory Conversation.fromJson(Map<String, dynamic> json) {
    return Conversation(
      id: json['_id'] as String,
      name: json['name'] as String? ?? '',
      lastMessageAt: json['lastMessageAt'] as String? ?? '',
    );
  }
}
