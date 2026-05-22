import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;
import '../../core/constants.dart';

/// Socket.IO 服务 + 事件桥接。
///
/// 所有 socket 事件统一在此注册，通过 Stream 暴露给上层。
/// Widget 通过 ref.listen 或 StreamBuilder 订阅，无需直接操作 socket。
class SocketService {
  io.Socket? _socket;
  final Set<String> _joinedGroups = {};

  // 事件 StreamControllers
  final _receiveMessageCtrl = StreamController<Map<String, dynamic>>.broadcast();
  final _receiveGroupMessageCtrl = StreamController<Map<String, dynamic>>.broadcast();
  final _scheduledTaskMessageCtrl = StreamController<Map<String, dynamic>>.broadcast();
  final _friendRequestAcceptedCtrl = StreamController<Map<String, dynamic>>.broadcast();
  final _aiStreamCtrl = StreamController<Map<String, dynamic>>.broadcast();
  final _aiStreamErrorCtrl = StreamController<dynamic>.broadcast();
  final _conversationRenamedCtrl = StreamController<Map<String, dynamic>>.broadcast();
  final _connectCtrl = StreamController<void>.broadcast();
  final _disconnectCtrl = StreamController<void>.broadcast();

  // 公开 Stream
  Stream<Map<String, dynamic>> get onReceiveMessage => _receiveMessageCtrl.stream;
  Stream<Map<String, dynamic>> get onReceiveGroupMessage => _receiveGroupMessageCtrl.stream;
  Stream<Map<String, dynamic>> get onScheduledTaskMessage => _scheduledTaskMessageCtrl.stream;
  Stream<Map<String, dynamic>> get onFriendRequestAccepted => _friendRequestAcceptedCtrl.stream;
  Stream<Map<String, dynamic>> get onAIStream => _aiStreamCtrl.stream;
  Stream<dynamic> get onAIStreamError => _aiStreamErrorCtrl.stream;
  Stream<Map<String, dynamic>> get onConversationRenamed => _conversationRenamedCtrl.stream;
  Stream<void> get onConnect => _connectCtrl.stream;
  Stream<void> get onDisconnect => _disconnectCtrl.stream;

  io.Socket? get socket => _socket;
  bool get isConnected => _socket?.connected ?? false;

  void connect(String token) {
    // 如果已有 socket 连接，先断开旧的
    if (_socket != null) {
      _socket!.clearListeners();
      _socket!.disconnect();
      _socket!.dispose();
      _socket = null;
    }

    _socket = io.io(
      AppConstants.socketUrl,
      io.OptionBuilder()
          .setAuth({'token': token})
          .setTransports(['websocket'])
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(-1) // 无限重连
          .setReconnectionDelay(1000)
          .setReconnectionDelayMax(30000) // 最大 30s 退避
          .build(),
    );

    _socket!.onConnect((_) {
      debugPrint('[Socket] connected');
      _connectCtrl.add(null);
      // 重连后重新加入之前的群房间
      _rejoinGroupRooms();
    });

    _socket!.onDisconnect((_) {
      debugPrint('[Socket] disconnected');
      _disconnectCtrl.add(null);
    });

    _socket!.onConnectError((err) {
      debugPrint('[Socket] connection error: $err');
    });

    // 注册业务事件 → 转发到 Stream
    _socket!.on('receive_message', (data) {
      if (data is Map<String, dynamic>) {
        _receiveMessageCtrl.add(data);
      }
    });

    _socket!.on('receive_group_message', (data) {
      if (data is Map<String, dynamic>) {
        _receiveGroupMessageCtrl.add(data);
      }
    });

    _socket!.on('scheduled_task_message', (data) {
      if (data is Map<String, dynamic>) {
        _scheduledTaskMessageCtrl.add(data);
      }
    });

    _socket!.on('friend_request_accepted', (data) {
      if (data is Map<String, dynamic>) {
        _friendRequestAcceptedCtrl.add(data);
      }
    });

    _socket!.on('ai_stream', (data) {
      if (data is Map<String, dynamic>) {
        _aiStreamCtrl.add(data);
      }
    });

    _socket!.on('ai_stream_error', (data) {
      _aiStreamErrorCtrl.add(data);
    });

    _socket!.on('conversation_renamed', (data) {
      if (data is Map<String, dynamic>) {
        _conversationRenamedCtrl.add(data);
      }
    });
  }

  void disconnect() {
    _joinedGroups.clear();
    _socket?.clearListeners();
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }

  void emit(String event, [dynamic data]) {
    if (_socket == null || !_socket!.connected) {
      debugPrint('[Socket] emit skipped (not connected): $event');
      return;
    }
    _socket!.emit(event, data);
  }

  void emitWithAck(String event, dynamic data, {required Function ack}) {
    if (_socket == null || !_socket!.connected) {
      debugPrint('[Socket] emitWithAck skipped (not connected): $event');
      return;
    }
    _socket!.emitWithAck(event, data, ack: ack);
  }

  /// 加入群房间
  void joinGroupRoom(String groupId) {
    _joinedGroups.add(groupId);
    emit('join_group_room', groupId);
  }

  /// 离开群房间
  void leaveGroupRoom(String groupId) {
    _joinedGroups.remove(groupId);
    emit('leave_group_room', groupId);
  }

  /// AI 流式聊天
  void emitAIChatStream(Map<String, dynamic> data) {
    emit('ai_chat_stream', data);
  }

  /// 重连后重新加入所有群房间
  void _rejoinGroupRooms() {
    for (final groupId in _joinedGroups) {
      _socket?.emit('join_group_room', groupId);
    }
  }

  /// 重新连接 Socket（如果未连接）
  void reconnect() {
    if (_socket == null || !_socket!.connected) {
      _socket?.connect();
    }
  }

  void dispose() {
    _socket?.clearListeners();
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
    _joinedGroups.clear();
    _receiveMessageCtrl.close();
    _receiveGroupMessageCtrl.close();
    _scheduledTaskMessageCtrl.close();
    _friendRequestAcceptedCtrl.close();
    _aiStreamCtrl.close();
    _aiStreamErrorCtrl.close();
    _conversationRenamedCtrl.close();
    _connectCtrl.close();
    _disconnectCtrl.close();
  }
}
