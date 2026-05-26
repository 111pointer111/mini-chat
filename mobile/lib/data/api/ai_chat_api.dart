import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'api_client.dart';

class AIChatStreamEvent {
  final String type;
  final String? content;
  final String? message;
  final String? stage;
  final String? conversationId;
  final String? conversationName;
  final String? reply;
  final List<dynamic> sources;
  final bool pendingTask;
  final bool taskCreated;

  const AIChatStreamEvent({
    required this.type,
    this.content,
    this.message,
    this.stage,
    this.conversationId,
    this.conversationName,
    this.reply,
    this.sources = const [],
    this.pendingTask = false,
    this.taskCreated = false,
  });

  factory AIChatStreamEvent.fromJson(Map<String, dynamic> json) {
    return AIChatStreamEvent(
      type: json['type'] as String? ?? '',
      content: json['content'] as String?,
      message: json['message'] as String?,
      stage: json['stage'] as String?,
      conversationId: json['conversationId'] as String?,
      conversationName: json['conversationName'] as String?,
      reply: json['reply'] as String?,
      sources: json['sources'] as List<dynamic>? ?? const [],
      pendingTask: json['pendingTask'] as bool? ?? false,
      taskCreated: json['taskCreated'] as bool? ?? false,
    );
  }
}

class AIChatApi {
  final ApiClient _client;
  final String? _token;

  AIChatApi(this._client, {String? token}) : _token = token;

  Future<Response> sendMessage(String message,
      {List<String>? modelImages,
      List<String>? displayImages,
      String? conversationId}) {
    return _client.dio.post('/ai-chat', data: {
      'message': message,
      if (modelImages != null && modelImages.isNotEmpty)
        'modelImages': modelImages,
      if (displayImages != null && displayImages.isNotEmpty)
        'displayImages': displayImages,
      if (conversationId != null) 'conversationId': conversationId,
    });
  }

  Future<Stream<AIChatStreamEvent>> streamMessage(
    String message, {
    List<String>? modelImages,
    List<String>? displayImages,
    String? conversationId,
  }) async {
    final uri = Uri.parse(
      '${_client.dio.options.baseUrl.replaceFirst(RegExp(r'/$'), '')}/ai-chat/stream',
    );
    final request = http.Request('POST', uri)
      ..headers.addAll({
        'Accept': 'text/event-stream',
        'Accept-Encoding': 'identity',
        'Cache-Control': 'no-cache',
        'Content-Type': 'application/json',
        if (_token != null && _token.isNotEmpty)
          'Authorization': 'Bearer $_token',
      })
      ..body = jsonEncode({
        'message': message,
        if (modelImages != null && modelImages.isNotEmpty)
          'modelImages': modelImages,
        if (displayImages != null && displayImages.isNotEmpty)
          'displayImages': displayImages,
        if (conversationId != null) 'conversationId': conversationId,
      });

    final httpClient = http.Client();
    try {
      final response =
          await httpClient.send(request).timeout(const Duration(seconds: 10));
      _debugLog(
          'connected status=${response.statusCode} headers=${response.headers}');

      if (response.statusCode < 200 || response.statusCode >= 300) {
        final body = await response.stream.bytesToString();
        httpClient.close();
        throw _badStreamResponse(uri, response.statusCode, body);
      }

      return _parseSse(
        response.stream,
        onDone: httpClient.close,
      );
    } catch (_) {
      httpClient.close();
      rethrow;
    }
  }

  Future<Response> getConversations() {
    return _client.dio.get('/ai-chat/conversations');
  }

  Future<Response> createConversation() {
    return _client.dio.post('/ai-chat/conversations', data: {});
  }

  Future<Response> renameConversation(String id, String name) {
    return _client.dio.put('/ai-chat/conversations/$id', data: {'name': name});
  }

  Future<Response> deleteConversation(String id) {
    return _client.dio.delete('/ai-chat/conversations/$id');
  }

  Future<Response> getHistory({String? convId}) {
    final path =
        convId != null ? '/ai-chat/history/$convId' : '/ai-chat/history';
    return _client.dio.get(path);
  }

  Stream<AIChatStreamEvent> _parseSse(
    Stream<List<int>> stream, {
    void Function()? onDone,
  }) async* {
    var buffer = '';
    final startedAt = DateTime.now();

    try {
      final decodedStream =
          stream.transform(StreamTransformer<List<int>, List<int>>.fromHandlers(
        handleData: (bytes, sink) {
          _debugLog(
            'raw bytes=${bytes.length} elapsed=${DateTime.now().difference(startedAt).inMilliseconds}ms',
          );
          sink.add(bytes);
        },
      )).transform(utf8.decoder);

      await for (final chunk in decodedStream) {
        buffer += chunk.replaceAll('\r\n', '\n').replaceAll('\r', '\n');

        while (true) {
          final delimiterIndex = buffer.indexOf('\n\n');
          if (delimiterIndex == -1) break;

          final rawEvent = buffer.substring(0, delimiterIndex);
          buffer = buffer.substring(delimiterIndex + 2);

          final event = _parseSseEvent(rawEvent);
          if (event != null) {
            yield event;
          }
        }
      }

      if (buffer.trim().isNotEmpty) {
        final event = _parseSseEvent(buffer);
        if (event != null) {
          yield event;
        }
      }
    } finally {
      _debugLog(
          'stream closed elapsed=${DateTime.now().difference(startedAt).inMilliseconds}ms');
      onDone?.call();
    }
  }

  AIChatStreamEvent? _parseSseEvent(String rawEvent) {
    final data = rawEvent
        .split('\n')
        .where((line) => line.startsWith('data:'))
        .map((line) => line.substring(5).trimLeft())
        .join('\n')
        .trim();

    if (data.isEmpty) return null;

    try {
      final decoded = jsonDecode(data);
      if (decoded is! Map<String, dynamic>) {
        return null;
      }

      final event = AIChatStreamEvent.fromJson(decoded);
      _debugLog('event type=${event.type}');
      return event;
    } on FormatException {
      _debugLog('ignored malformed event length=${rawEvent.length}');
      return null;
    }
  }

  DioException _badStreamResponse(Uri uri, int statusCode, String body) {
    dynamic data = body;
    try {
      data = jsonDecode(body);
    } on FormatException {
      // Keep the raw body.
    }

    final requestOptions = RequestOptions(
      path: uri.toString(),
      method: 'POST',
    );
    return DioException(
      requestOptions: requestOptions,
      response: Response(
        requestOptions: requestOptions,
        statusCode: statusCode,
        data: data,
      ),
      type: DioExceptionType.badResponse,
      message: data is Map<String, dynamic>
          ? data['message'] as String?
          : 'AI stream request failed',
    );
  }

  void _debugLog(String message) {
    if (kDebugMode) {
      debugPrint('[AIChatSSE] $message');
    }
  }
}
