import 'package:dio/dio.dart';
import 'api_client.dart';

class ScheduledTaskApi {
  final ApiClient _client;

  ScheduledTaskApi(this._client);

  Future<Response> getTasks() {
    return _client.dio.get('/scheduled-tasks');
  }

  Future<Response> getConversations() {
    return _client.dio.get('/scheduled-tasks/conversations');
  }

  Future<Response> updatePresetTask(String taskType, Map<String, dynamic> data) {
    return _client.dio.put('/scheduled-tasks/$taskType', data: data);
  }

  Future<Response> getTaskMessages(String taskType) {
    return _client.dio.get('/scheduled-tasks/$taskType/messages');
  }

  Future<Response> updateCustomTask(String taskId, Map<String, dynamic> data) {
    return _client.dio.put('/scheduled-tasks/custom/$taskId', data: data);
  }

  Future<Response> deleteCustomTask(String taskId) {
    return _client.dio.delete('/scheduled-tasks/custom/$taskId');
  }
}
