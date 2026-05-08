import 'user.dart';

class FriendRequest {
  final String id;
  final User requester;
  final User recipient;
  final String status; // 'pending', 'accepted', 'rejected'
  final String createdAt;

  FriendRequest({
    required this.id,
    required this.requester,
    required this.recipient,
    required this.status,
    required this.createdAt,
  });

  factory FriendRequest.fromJson(Map<String, dynamic> json) {
    return FriendRequest(
      id: json['_id'] as String,
      requester: User.fromJson(json['requester'] as Map<String, dynamic>),
      recipient: User.fromJson(json['recipient'] as Map<String, dynamic>),
      status: json['status'] as String? ?? 'pending',
      createdAt: json['createdAt'] as String? ?? '',
    );
  }
}
