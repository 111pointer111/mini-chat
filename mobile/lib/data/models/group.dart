class Group {
  final String id;
  final String name;
  final String? description;
  final String? avatar;
  final bool assistantEnabled;
  final String? role; // 'owner', 'admin', 'member'
  final String createdAt;

  Group({
    required this.id,
    required this.name,
    this.description,
    this.avatar,
    this.assistantEnabled = false,
    this.role,
    required this.createdAt,
  });

  factory Group.fromJson(Map<String, dynamic> json) {
    return Group(
      id: json['_id'] as String,
      name: json['name'] as String? ?? '',
      description: json['description'] as String?,
      avatar: json['avatar'] as String?,
      assistantEnabled: json['assistantEnabled'] as bool? ?? false,
      role: json['role'] as String?,
      createdAt: json['createdAt'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'name': name,
      if (description != null) 'description': description,
      if (avatar != null) 'avatar': avatar,
      'assistantEnabled': assistantEnabled,
      if (role != null) 'role': role,
      'createdAt': createdAt,
    };
  }
}
