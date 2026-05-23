import 'package:flutter/foundation.dart';
import 'database_service.dart';
import '../models/message.dart';
import '../models/user.dart';

class CacheService {
  static final CacheService _instance = CacheService._internal();
  factory CacheService() => _instance;
  CacheService._internal();

  final DatabaseService _db = DatabaseService();

  // ============================================================
  // 消息缓存
  // ============================================================

  /// 获取会话的最新消息（先缓存后网络）
  Future<List<Message>> getMessages(String conversationId, {int limit = 100}) async {
    try {
      return await _db.getLatestMessages(conversationId, limit: limit);
    } catch (e) {
      debugPrint('[CacheService] getMessages error: $e');
      return [];
    }
  }

  /// 获取更早的消息（上滑加载更多）
  Future<List<Message>> getEarlierMessages(String conversationId, String before, {int limit = 100}) async {
    try {
      return await _db.getEarlierMessages(conversationId, before, limit: limit);
    } catch (e) {
      debugPrint('[CacheService] getEarlierMessages error: $e');
      return [];
    }
  }

  /// 缓存消息列表
  Future<void> cacheMessages(String conversationId, List<Message> messages) async {
    try {
      await _db.insertMessages(messages, conversationId);
    } catch (e) {
      debugPrint('[CacheService] cacheMessages error: $e');
    }
  }

  /// 缓存单条消息
  Future<void> cacheMessage({
    required String id,
    required String conversationId,
    required String senderId,
    String? senderName,
    String? senderAvatar,
    String? receiverId,
    String? groupId,
    required String content,
    String type = 'text',
    List<String>? images,
    bool mentionAssistant = false,
    required String createdAt,
  }) async {
    try {
      await _db.insertMessage(
        id: id,
        conversationId: conversationId,
        senderId: senderId,
        senderName: senderName,
        senderAvatar: senderAvatar,
        receiverId: receiverId,
        groupId: groupId,
        content: content,
        type: type,
        images: images,
        mentionAssistant: mentionAssistant,
        createdAt: createdAt,
      );
    } catch (e) {
      debugPrint('[CacheService] cacheMessage error: $e');
    }
  }

  /// 获取消息数量
  Future<int> getMessageCount(String conversationId) async {
    try {
      return await _db.getMessageCount(conversationId);
    } catch (e) {
      debugPrint('[CacheService] getMessageCount error: $e');
      return 0;
    }
  }

  // ============================================================
  // 会话缓存
  // ============================================================

  /// 获取会话列表
  Future<List<Map<String, dynamic>>> getConversations(String userId) async {
    try {
      return await _db.getConversations(userId);
    } catch (e) {
      debugPrint('[CacheService] getConversations error: $e');
      return [];
    }
  }

  /// 缓存会话
  Future<void> cacheConversation({
    required String id,
    required String userId,
    required String type,
    required String name,
    String? taskType,
    String? participantId,
    String? groupId,
    String? lastMessageAt,
    String? lastMessagePreview,
    int unreadCount = 0,
  }) async {
    try {
      await _db.insertConversation(
        id: id,
        userId: userId,
        type: type,
        name: name,
        taskType: taskType,
        participantId: participantId,
        groupId: groupId,
        lastMessageAt: lastMessageAt,
        lastMessagePreview: lastMessagePreview,
        unreadCount: unreadCount,
      );
    } catch (e) {
      debugPrint('[CacheService] cacheConversation error: $e');
    }
  }

  /// 更新会话的最后消息
  Future<void> updateConversationLastMessage(String conversationId, String preview, String lastMessageAt) async {
    try {
      await _db.updateConversationLastMessage(conversationId, preview, lastMessageAt);
    } catch (e) {
      debugPrint('[CacheService] updateConversationLastMessage error: $e');
    }
  }

  /// 增加未读消息数
  Future<void> incrementUnreadCount(String conversationId) async {
    try {
      await _db.incrementUnreadCount(conversationId);
    } catch (e) {
      debugPrint('[CacheService] incrementUnreadCount error: $e');
    }
  }

  /// 重置未读消息数
  Future<void> resetUnreadCount(String conversationId) async {
    try {
      await _db.resetUnreadCount(conversationId);
    } catch (e) {
      debugPrint('[CacheService] resetUnreadCount error: $e');
    }
  }

  // ============================================================
  // 用户缓存
  // ============================================================

  /// 缓存用户
  Future<void> cacheUser(User user) async {
    try {
      await _db.insertUser(user);
    } catch (e) {
      debugPrint('[CacheService] cacheUser error: $e');
    }
  }

  /// 批量缓存用户
  Future<void> cacheUsers(List<User> users) async {
    try {
      await _db.insertUsers(users);
    } catch (e) {
      debugPrint('[CacheService] cacheUsers error: $e');
    }
  }

  /// 获取用户
  Future<User?> getUser(String userId) async {
    try {
      return await _db.getUser(userId);
    } catch (e) {
      debugPrint('[CacheService] getUser error: $e');
      return null;
    }
  }

  // ============================================================
  // 好友缓存
  // ============================================================

  /// 缓存好友关系
  Future<void> cacheFriendship(String id, String requesterId, String recipientId, String status) async {
    try {
      await _db.insertFriendship(id, requesterId, recipientId, status);
    } catch (e) {
      debugPrint('[CacheService] cacheFriendship error: $e');
    }
  }

  /// 获取好友列表
  Future<List<Map<String, dynamic>>> getFriends(String userId) async {
    try {
      return await _db.getFriends(userId);
    } catch (e) {
      debugPrint('[CacheService] getFriends error: $e');
      return [];
    }
  }

  // ============================================================
  // 群组缓存
  // ============================================================

  /// 缓存群组
  Future<void> cacheGroup(String id, String name, String? description, String ownerId, String? avatar, bool assistantEnabled) async {
    try {
      await _db.insertGroup(id, name, description, ownerId, avatar, assistantEnabled);
    } catch (e) {
      debugPrint('[CacheService] cacheGroup error: $e');
    }
  }

  /// 缓存群成员
  Future<void> cacheGroupMember(String id, String groupId, String userId, String role, String? joinedAt) async {
    try {
      await _db.insertGroupMember(id, groupId, userId, role, joinedAt);
    } catch (e) {
      debugPrint('[CacheService] cacheGroupMember error: $e');
    }
  }

  /// 获取用户的群组列表
  Future<List<Map<String, dynamic>>> getUserGroups(String userId) async {
    try {
      return await _db.getUserGroups(userId);
    } catch (e) {
      debugPrint('[CacheService] getUserGroups error: $e');
      return [];
    }
  }

  // ============================================================
  // 同步状态
  // ============================================================

  /// 更新同步状态
  Future<void> updateSyncStatus({
    required String conversationId,
    String? lastMessageId,
    String? lastMessageTime,
    String syncType = 'incremental',
  }) async {
    try {
      await _db.updateSyncStatus(
        conversationId: conversationId,
        lastMessageId: lastMessageId,
        lastMessageTime: lastMessageTime,
        syncType: syncType,
      );
    } catch (e) {
      debugPrint('[CacheService] updateSyncStatus error: $e');
    }
  }

  /// 获取同步状态
  Future<Map<String, dynamic>?> getSyncStatus(String conversationId) async {
    try {
      return await _db.getSyncStatus(conversationId);
    } catch (e) {
      debugPrint('[CacheService] getSyncStatus error: $e');
      return null;
    }
  }

  // ============================================================
  // 清理操作
  // ============================================================

  /// 清理旧消息（超过7天）
  Future<void> cleanupOldMessages() async {
    try {
      final cutoff = DateTime.now().subtract(const Duration(days: 7));
      await _db.deleteOldMessages(cutoff.toIso8601String());
      debugPrint('[CacheService] Cleaned up old messages');
    } catch (e) {
      debugPrint('[CacheService] cleanupOldMessages error: $e');
    }
  }

  /// 每个会话只保留最近100条消息
  Future<void> keepOnlyRecentMessages({int keepCount = 100}) async {
    try {
      await _db.keepOnlyRecentMessages(keepCount);
      debugPrint('[CacheService] Kept only recent $keepCount messages per conversation');
    } catch (e) {
      debugPrint('[CacheService] keepOnlyRecentMessages error: $e');
    }
  }

  /// 清理没有消息的会话
  Future<void> deleteEmptyConversations() async {
    try {
      await _db.deleteEmptyConversations();
      debugPrint('[CacheService] Deleted empty conversations');
    } catch (e) {
      debugPrint('[CacheService] deleteEmptyConversations error: $e');
    }
  }

  /// 清理过期的好友关系缓存
  Future<void> cleanupOldFriendships() async {
    try {
      await _db.cleanupOldFriendships();
      debugPrint('[CacheService] Cleaned up old friendships');
    } catch (e) {
      debugPrint('[CacheService] cleanupOldFriendships error: $e');
    }
  }

  /// 执行完整的清理流程
  Future<void> performFullCleanup() async {
    await cleanupOldMessages();
    await keepOnlyRecentMessages();
    await deleteEmptyConversations();
    await cleanupOldFriendships();
    debugPrint('[CacheService] Full cleanup completed');
  }

  /// 清除所有缓存
  Future<void> clearAll() async {
    try {
      await _db.clearAll();
      debugPrint('[CacheService] Cleared all cache');
    } catch (e) {
      debugPrint('[CacheService] clearAll error: $e');
    }
  }
}
