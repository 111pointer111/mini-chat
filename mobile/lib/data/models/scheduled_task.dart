class PresetTask {
  final String? id;
  final String taskType;
  final String taskName;
  final bool enabled;
  final String pushTime;
  final String? conversationId;

  PresetTask({
    this.id,
    required this.taskType,
    required this.taskName,
    required this.enabled,
    required this.pushTime,
    this.conversationId,
  });

  factory PresetTask.fromJson(Map<String, dynamic> json) {
    return PresetTask(
      id: json['_id'] as String?,
      taskType: json['taskType'] as String? ?? '',
      taskName: json['taskName'] as String? ?? '',
      enabled: json['enabled'] as bool? ?? false,
      pushTime: json['pushTime'] as String? ?? '09:00',
      conversationId: json['conversationId'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    if (id != null) '_id': id,
    'taskType': taskType,
    'taskName': taskName,
    'enabled': enabled,
    'pushTime': pushTime,
    if (conversationId != null) 'conversationId': conversationId,
  };
}

class CustomTask {
  final String id;
  final String taskType;
  final String taskName;
  final String? prompt;
  final bool enabled;
  final String pushTime;
  final String? conversationId;

  CustomTask({
    required this.id,
    required this.taskType,
    required this.taskName,
    this.prompt,
    required this.enabled,
    required this.pushTime,
    this.conversationId,
  });

  factory CustomTask.fromJson(Map<String, dynamic> json) {
    return CustomTask(
      id: json['_id'] as String? ?? '',
      taskType: json['taskType'] as String? ?? 'custom',
      taskName: json['taskName'] as String? ?? '',
      prompt: json['prompt'] as String?,
      enabled: json['enabled'] as bool? ?? false,
      pushTime: json['pushTime'] as String? ?? '09:00',
      conversationId: json['conversationId'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
    '_id': id,
    'taskType': taskType,
    'taskName': taskName,
    if (prompt != null) 'prompt': prompt,
    'enabled': enabled,
    'pushTime': pushTime,
    if (conversationId != null) 'conversationId': conversationId,
  };
}

class TasksResponse {
  final List<PresetTask> presetTasks;
  final List<CustomTask> customTasks;

  TasksResponse({
    required this.presetTasks,
    required this.customTasks,
  });

  factory TasksResponse.fromJson(Map<String, dynamic> json) {
    return TasksResponse(
      presetTasks: (json['presetTasks'] as List<dynamic>?)
              ?.map((e) => PresetTask.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      customTasks: (json['customTasks'] as List<dynamic>?)
              ?.map((e) => CustomTask.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  Map<String, dynamic> toJson() => {
    'presetTasks': presetTasks.map((e) => e.toJson()).toList(),
    'customTasks': customTasks.map((e) => e.toJson()).toList(),
  };
}
