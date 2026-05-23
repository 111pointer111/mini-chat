import 'package:sqflite/sqflite.dart';
import 'package:path/path.dart';
import '../models/message.dart';
import '../models/user.dart';

class DatabaseService {
  static Database? _database;
  static const String _dbName = 'bolt_chat.db';
  static const int _dbVersion = 1;

  Future<Database> get database async {
    if (_database != null) return _database!;
    _database = await _initDatabase();
    return _database!;
  }

  Future<Database> _initDatabase() async {
    final databasesPath = await getDatabasesPath();
    final path = join(databasesPath, _dbName);

    return await openDatabase(
      path,
      version: _dbVersion,
      onCreate: _onCreate,
      onUpgrade: _onUpgrade,
    );
  }

  Future<void> _onCreate(Database db, int version) async {
    await _createTables(db);
  }

  Future<void> _onUpgrade(Database db, int oldVersion, int newVersion) async {
    // 未来版本升级时的迁移逻辑
  }

  Future<void> _createTables(Database db) async {
    // 用户表
    await db.execute('''
      CREATE TABLE users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        avatar TEXT DEFAULT '',
        role TEXT DEFAULT 'user',
        provider TEXT DEFAULT 'local',
        is_phone_verified INTEGER DEFAULT 0,
        is_email_verified INTEGER DEFAULT 0,
        cached_at TEXT NOT NULL,
        updated_at TEXT
      )
    ''');

    // 好友关系表
    await db.execute('''
      CREATE TABLE friendships (
        id TEXT PRIMARY KEY,
        requester_id TEXT NOT NULL,
        recipient_id TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        cached_at TEXT NOT NULL,
        FOREIGN KEY (requester_id) REFERENCES users(id),
        FOREIGN KEY (recipient_id) REFERENCES users(id)
      )
    ''');

    // 群组表
    await db.execute('''
      CREATE TABLE groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        owner_id TEXT NOT NULL,
        avatar TEXT DEFAULT '',
        assistant_enabled INTEGER DEFAULT 1,
        cached_at TEXT NOT NULL,
        updated_at TEXT,
        FOREIGN KEY (owner_id) REFERENCES users(id)
      )
    ''');

    // 群成员表
    await db.execute('''
      CREATE TABLE group_members (
        id TEXT PRIMARY KEY,
        group_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        role TEXT DEFAULT 'member',
        joined_at TEXT,
        cached_at TEXT NOT NULL,
        FOREIGN KEY (group_id) REFERENCES groups(id),
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    ''');

    // 会话表
    await db.execute('''
      CREATE TABLE conversations (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        name TEXT NOT NULL,
        task_type TEXT,
        participant_id TEXT,
        group_id TEXT,
        last_message_at TEXT,
        last_message_preview TEXT,
        unread_count INTEGER DEFAULT 0,
        cached_at TEXT NOT NULL,
        updated_at TEXT,
        FOREIGN KEY (participant_id) REFERENCES users(id),
        FOREIGN KEY (group_id) REFERENCES groups(id)
      )
    ''');

    // 消息表
    await db.execute('''
      CREATE TABLE messages (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        sender_id TEXT NOT NULL,
        sender_name TEXT,
        sender_avatar TEXT,
        receiver_id TEXT,
        group_id TEXT,
        content TEXT NOT NULL,
        type TEXT DEFAULT 'text',
        images TEXT,
        mentions TEXT,
        mention_assistant INTEGER DEFAULT 0,
        read INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        cached_at TEXT NOT NULL,
        is_synced INTEGER DEFAULT 1,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id),
        FOREIGN KEY (sender_id) REFERENCES users(id)
      )
    ''');

    // 同步状态表
    await db.execute('''
      CREATE TABLE sync_status (
        conversation_id TEXT PRIMARY KEY,
        last_sync_at TEXT NOT NULL,
        last_message_id TEXT,
        last_message_time TEXT,
        sync_type TEXT DEFAULT 'full',
        FOREIGN KEY (conversation_id) REFERENCES conversations(id)
      )
    ''');

    // 创建索引
    await db.execute('CREATE INDEX idx_users_username ON users(username)');
    await db.execute('CREATE UNIQUE INDEX idx_friendships_users ON friendships(requester_id, recipient_id)');
    await db.execute('CREATE INDEX idx_friendships_status ON friendships(status)');
    await db.execute('CREATE INDEX idx_groups_owner ON groups(owner_id)');
    await db.execute('CREATE UNIQUE INDEX idx_group_members_pair ON group_members(group_id, user_id)');
    await db.execute('CREATE INDEX idx_group_members_user ON group_members(user_id)');
    await db.execute('CREATE INDEX idx_conversations_user ON conversations(user_id, type)');
    await db.execute('CREATE INDEX idx_conversations_last_message ON conversations(last_message_at DESC)');
    await db.execute('CREATE INDEX idx_messages_conversation_time ON messages(conversation_id, created_at DESC)');
    await db.execute('CREATE INDEX idx_messages_unread ON messages(conversation_id, read, created_at DESC)');
    await db.execute('CREATE INDEX idx_messages_sender ON messages(sender_id, created_at DESC)');
  }

  // ============================================================
  // 用户相关操作
  // ============================================================

  Future<void> insertUser(User user) async {
    final db = await database;
    await db.insert(
      'users',
      {
        'id': user.id,
        'username': user.username,
        'email': user.email,
        'phone': user.phone,
        'avatar': user.avatar,
        'role': user.role,
        'cached_at': DateTime.now().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<User?> getUser(String userId) async {
    final db = await database;
    final maps = await db.query(
      'users',
      where: 'id = ?',
      whereArgs: [userId],
    );
    if (maps.isEmpty) return null;
    return _mapToUser(maps.first);
  }

  Future<void> insertUsers(List<User> users) async {
    final db = await database;
    final batch = db.batch();
    for (final user in users) {
      batch.insert(
        'users',
        {
          'id': user.id,
          'username': user.username,
          'email': user.email,
          'phone': user.phone,
          'avatar': user.avatar,
          'role': user.role,
          'cached_at': DateTime.now().toIso8601String(),
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }

  User _mapToUser(Map<String, dynamic> map) {
    return User(
      id: map['id'] as String,
      username: map['username'] as String,
      email: map['email'] as String? ?? '',
      phone: map['phone'] as String? ?? '',
      avatar: map['avatar'] as String? ?? '',
      role: map['role'] as String? ?? 'user',
    );
  }

  // ============================================================
  // 好友关系相关操作
  // ============================================================

  Future<void> insertFriendship(String id, String requesterId, String recipientId, String status) async {
    final db = await database;
    await db.insert(
      'friendships',
      {
        'id': id,
        'requester_id': requesterId,
        'recipient_id': recipientId,
        'status': status,
        'cached_at': DateTime.now().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<Map<String, dynamic>>> getFriends(String userId) async {
    final db = await database;
    return await db.rawQuery('''
      SELECT u.* FROM users u
      INNER JOIN friendships f ON (
        (f.requester_id = ? AND f.recipient_id = u.id) OR
        (f.recipient_id = ? AND f.requester_id = u.id)
      )
      WHERE f.status = 'accepted'
      ORDER BY u.username
    ''', [userId, userId]);
  }

  // ============================================================
  // 群组相关操作
  // ============================================================

  Future<void> insertGroup(String id, String name, String? description, String ownerId, String? avatar, bool assistantEnabled) async {
    final db = await database;
    await db.insert(
      'groups',
      {
        'id': id,
        'name': name,
        'description': description,
        'owner_id': ownerId,
        'avatar': avatar ?? '',
        'assistant_enabled': assistantEnabled ? 1 : 0,
        'cached_at': DateTime.now().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<void> insertGroupMember(String id, String groupId, String userId, String role, String? joinedAt) async {
    final db = await database;
    await db.insert(
      'group_members',
      {
        'id': id,
        'group_id': groupId,
        'user_id': userId,
        'role': role,
        'joined_at': joinedAt,
        'cached_at': DateTime.now().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<List<Map<String, dynamic>>> getUserGroups(String userId) async {
    final db = await database;
    return await db.rawQuery('''
      SELECT g.* FROM groups g
      INNER JOIN group_members gm ON gm.group_id = g.id
      WHERE gm.user_id = ?
      ORDER BY g.name
    ''', [userId]);
  }

  // ============================================================
  // 会话相关操作
  // ============================================================

  Future<void> insertConversation({
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
    final db = await database;
    await db.insert(
      'conversations',
      {
        'id': id,
        'user_id': userId,
        'type': type,
        'name': name,
        'task_type': taskType,
        'participant_id': participantId,
        'group_id': groupId,
        'last_message_at': lastMessageAt,
        'last_message_preview': lastMessagePreview,
        'unread_count': unreadCount,
        'cached_at': DateTime.now().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<void> insertConversations(List<Map<String, dynamic>> conversations) async {
    final db = await database;
    final batch = db.batch();
    for (final conv in conversations) {
      batch.insert(
        'conversations',
        {
          ...conv,
          'cached_at': DateTime.now().toIso8601String(),
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }

  Future<List<Map<String, dynamic>>> getConversations(String userId) async {
    final db = await database;
    return await db.query(
      'conversations',
      where: 'user_id = ?',
      whereArgs: [userId],
      orderBy: 'last_message_at DESC',
    );
  }

  Future<void> updateConversationLastMessage(String conversationId, String preview, String lastMessageAt) async {
    final db = await database;
    await db.update(
      'conversations',
      {
        'last_message_preview': preview,
        'last_message_at': lastMessageAt,
        'updated_at': DateTime.now().toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [conversationId],
    );
  }

  Future<void> incrementUnreadCount(String conversationId) async {
    final db = await database;
    await db.rawUpdate('''
      UPDATE conversations 
      SET unread_count = unread_count + 1,
          updated_at = ?
      WHERE id = ?
    ''', [DateTime.now().toIso8601String(), conversationId]);
  }

  Future<void> resetUnreadCount(String conversationId) async {
    final db = await database;
    await db.update(
      'conversations',
      {
        'unread_count': 0,
        'updated_at': DateTime.now().toIso8601String(),
      },
      where: 'id = ?',
      whereArgs: [conversationId],
    );
  }

  // ============================================================
  // 消息相关操作
  // ============================================================

  Future<void> insertMessage({
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
    List<String>? mentions,
    bool mentionAssistant = false,
    bool read = false,
    required String createdAt,
  }) async {
    final db = await database;
    await db.insert(
      'messages',
      {
        'id': id,
        'conversation_id': conversationId,
        'sender_id': senderId,
        'sender_name': senderName,
        'sender_avatar': senderAvatar,
        'receiver_id': receiverId,
        'group_id': groupId,
        'content': content,
        'type': type,
        'images': images != null ? _listToJson(images) : null,
        'mentions': mentions != null ? _listToJson(mentions) : null,
        'mention_assistant': mentionAssistant ? 1 : 0,
        'read': read ? 1 : 0,
        'created_at': createdAt,
        'cached_at': DateTime.now().toIso8601String(),
        'is_synced': 1,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<void> insertMessages(List<Message> messages, String conversationId) async {
    final db = await database;
    final batch = db.batch();
    for (final msg in messages) {
      batch.insert(
        'messages',
        {
          'id': msg.id,
          'conversation_id': conversationId,
          'sender_id': msg.senderId,
          'sender_name': msg.senderUser?.username,
          'sender_avatar': msg.senderUser?.avatar,
          'receiver_id': msg.receiver,
          'group_id': msg.groupId,
          'content': msg.content,
          'type': msg.type,
          'images': msg.images != null ? _listToJson(msg.images!) : null,
          'mention_assistant': msg.mentionAssistant ? 1 : 0,
          'created_at': msg.createdAt,
          'cached_at': DateTime.now().toIso8601String(),
          'is_synced': 1,
        },
        conflictAlgorithm: ConflictAlgorithm.replace,
      );
    }
    await batch.commit(noResult: true);
  }

  Future<List<Message>> getLatestMessages(String conversationId, {int limit = 100}) async {
    final db = await database;
    final maps = await db.query(
      'messages',
      where: 'conversation_id = ?',
      whereArgs: [conversationId],
      orderBy: 'created_at DESC',
      limit: limit,
    );
    return maps.map((map) => _mapToMessage(map)).toList().reversed.toList();
  }

  Future<List<Message>> getEarlierMessages(String conversationId, String before, {int limit = 100}) async {
    final db = await database;
    final maps = await db.query(
      'messages',
      where: 'conversation_id = ? AND created_at < ?',
      whereArgs: [conversationId, before],
      orderBy: 'created_at DESC',
      limit: limit,
    );
    return maps.map((map) => _mapToMessage(map)).toList().reversed.toList();
  }

  Future<int> getMessageCount(String conversationId) async {
    final db = await database;
    final result = await db.rawQuery(
      'SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?',
      [conversationId],
    );
    return Sqflite.firstIntValue(result) ?? 0;
  }

  Message _mapToMessage(Map<String, dynamic> map) {
    return Message(
      id: map['id'] as String,
      sender: map['sender_id'] as String,
      receiver: map['receiver_id'] as String?,
      groupId: map['group_id'] as String?,
      content: map['content'] as String,
      type: map['type'] as String? ?? 'text',
      createdAt: map['created_at'] as String,
      mentionAssistant: (map['mention_assistant'] as int?) == 1,
      images: map['images'] != null ? _jsonToList(map['images'] as String) : null,
    );
  }

  // ============================================================
  // 同步状态相关操作
  // ============================================================

  Future<void> updateSyncStatus({
    required String conversationId,
    String? lastMessageId,
    String? lastMessageTime,
    String syncType = 'incremental',
  }) async {
    final db = await database;
    await db.insert(
      'sync_status',
      {
        'conversation_id': conversationId,
        'last_sync_at': DateTime.now().toIso8601String(),
        'last_message_id': lastMessageId,
        'last_message_time': lastMessageTime,
        'sync_type': syncType,
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<Map<String, dynamic>?> getSyncStatus(String conversationId) async {
    final db = await database;
    final maps = await db.query(
      'sync_status',
      where: 'conversation_id = ?',
      whereArgs: [conversationId],
    );
    return maps.isNotEmpty ? maps.first : null;
  }

  // ============================================================
  // 清理操作
  // ============================================================

  Future<void> deleteOldMessages(String before) async {
    final db = await database;
    await db.delete(
      'messages',
      where: 'created_at < ?',
      whereArgs: [before],
    );
  }

  Future<void> keepOnlyRecentMessages(int keepCount) async {
    final db = await database;
    // 获取所有会话
    final conversations = await db.query('conversations', columns: ['id']);
    
    for (final conv in conversations) {
      final conversationId = conv['id'] as String;
      // 删除超出限制的旧消息
      await db.rawDelete('''
        DELETE FROM messages 
        WHERE conversation_id = ? 
        AND id NOT IN (
          SELECT id FROM messages 
          WHERE conversation_id = ? 
          ORDER BY created_at DESC 
          LIMIT ?
        )
      ''', [conversationId, conversationId, keepCount]);
    }
  }

  Future<void> deleteEmptyConversations() async {
    final db = await database;
    await db.rawDelete('''
      DELETE FROM conversations 
      WHERE id NOT IN (
        SELECT DISTINCT conversation_id FROM messages
      )
    ''');
  }

  Future<void> cleanupOldFriendships() async {
    final db = await database;
    final cutoff = DateTime.now().subtract(const Duration(days: 30)).toIso8601String();
    await db.delete(
      'friendships',
      where: 'cached_at < ? AND status = ?',
      whereArgs: [cutoff, 'pending'],
    );
  }

  Future<void> clearAll() async {
    final db = await database;
    await db.delete('messages');
    await db.delete('conversations');
    await db.delete('friendships');
    await db.delete('group_members');
    await db.delete('groups');
    await db.delete('users');
    await db.delete('sync_status');
  }

  // ============================================================
  // 辅助方法
  // ============================================================

  String _listToJson(List<String> list) {
    return list.map((e) => '"$e"').join(',');
  }

  List<String> _jsonToList(String json) {
    if (json.isEmpty) return [];
    return json.split(',').map((e) => e.replaceAll('"', '').trim()).toList();
  }

  Future<void> close() async {
    final db = await database;
    await db.close();
    _database = null;
  }
}
