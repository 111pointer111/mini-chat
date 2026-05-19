class User {
  final String id;
  final String username;
  final String email;
  final String phone;
  final String avatar;
  final String role;

  User({
    required this.id,
    required this.username,
    this.email = '',
    this.phone = '',
    this.avatar = '',
    this.role = 'user',
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['_id'] as String,
      username: json['username'] as String? ?? '',
      email: json['email'] as String? ?? '',
      phone: json['phone'] as String? ?? '',
      avatar: json['avatar'] as String? ?? '',
      role: json['role'] as String? ?? 'user',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      '_id': id,
      'username': username,
      'email': email,
      'phone': phone,
      'avatar': avatar,
      'role': role,
    };
  }
}
