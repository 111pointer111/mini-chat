import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'api_client.dart';

class AIChatStreamEvent {
  final String type;
  final String? content;
  final String? message;
  final String? conversationId;
  final String? conversationName;
  final List<dynamic> sources;
  final bool pendingTask;
  final bool taskCreated;

  const AIChatStreamEvent({
    required this.type,
    this.content,
    this.message,
    this.conversationId,
    this.conversationName,
    this.sources = const [],
    this.pendingTask = false,
    this.taskCreated = false,
  });

  factory AIChatStreamEvent.fromJson(Map<String, dynamic> json) {
    return AIChatStreamEvent(
      type: json['type'] as String? ?? '',
      content: json['content'] as String?,
      message: json['message'] as String?,
      conversationId: json['conversationId'] as String?,
      conversationName: json['conversationName'] as String?,
      sources: json['sources'] as List<dynamic>? ?? const [],
      pendingTask: json['pendingTask'] as bool? ?? false,
      taskCreated: json['taskCreated'] as bool? ?? false,
    );
  }
}

class AIChatApi {
  final ApiClient _client;

  AIChatApi(this._client);

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
    final response = await _client.dio.post<ResponseBody>(
      '/ai-chat/stream',
      data: {
        'message': message,
        if (modelImages != null && modelImages.isNotEmpty)
          'modelImages': modelImages,
        if (displayImages != null && displayImages.isNotEmpty)
          'displayImages': displayImages,
        if (conversationId != null) 'conversationId': conversationId,
      },
      options: Options(
        responseType: ResponseType.stream,
        headers: {'Accept': 'text/event-stream'},
        receiveTimeout: const Duration(minutes: 5),
      ),
    );

    final body = response.data;
    if (body == null) {
      throw const FormatException('Invalid stream response');
    }

    return _parseSse(body.stream);
  }

  Future<Response> getConversations() {
    return _client.dio.get('/ai-chat/conversations');
  }

  Future<Response> createConversation() {
    return _client.dio.post('/ai-chat/conversations');
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

  Stream<AIChatStreamEvent> _parseSse(Stream<List<int>> stream) async* {
    var buffer = '';

    await for (final chunk in stream.transform(utf8.decoder)) {
      buffer += chunk;

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

    final event = _parseSseEvent(buffer);
    if (event != null) {
      yield event;
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

    final decoded = jsonDecode(data);
    if (decoded is! Map<String, dynamic>) {
      throw const FormatException('Invalid stream event');
    }

    return AIChatStreamEvent.fromJson(decoded);
  }
}
