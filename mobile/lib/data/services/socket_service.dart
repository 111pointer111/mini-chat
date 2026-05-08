import 'package:socket_io_client/socket_io_client.dart' as io;
import '../../core/constants.dart';

class SocketService {
  io.Socket? _socket;

  io.Socket? get socket => _socket;
  bool get isConnected => _socket?.connected ?? false;

  void connect(String token) {
    if (_socket != null && _socket!.connected) return;

    _socket = io.io(
      AppConstants.socketUrl,
      io.OptionBuilder()
          .setAuth({'token': token})
          .setTransports(['websocket'])
          .enableAutoConnect()
          .enableReconnection()
          .setReconnectionAttempts(5)
          .setReconnectionDelay(1000)
          .build(),
    );

    _socket!.onConnect((_) {
      print('Socket connected: ${_socket!.id}');
    });

    _socket!.onDisconnect((_) {
      print('Socket disconnected');
    });

    _socket!.onConnectError((err) {
      print('Socket connection error: $err');
    });
  }

  void disconnect() {
    _socket?.disconnect();
    _socket?.dispose();
    _socket = null;
  }

  void emit(String event, [dynamic data, Function? ack]) {
    if (ack != null) {
      _socket?.emitWithAck(event, data, ack: ack);
    } else {
      _socket?.emit(event, data);
    }
  }

  void on(String event, Function(dynamic) handler) {
    _socket?.on(event, handler);
  }

  void off(String event) {
    _socket?.off(event);
  }
}
