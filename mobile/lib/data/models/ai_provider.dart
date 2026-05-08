class AIProvider {
  final String id;
  final String name;
  final String baseURL;
  final String modelName;
  final String? embeddingApiKey;
  final String? embeddingModel;
  final String? embeddingBaseURL;
  final int? embeddingDimensions;
  final String? groupId;
  final bool enabled;
  final bool isDefault;
  final String createdAt;

  AIProvider({
    required this.id,
    required this.name,
    required this.baseURL,
    required this.modelName,
    this.embeddingApiKey,
    this.embeddingModel,
    this.embeddingBaseURL,
    this.embeddingDimensions,
    this.groupId,
    required this.enabled,
    required this.isDefault,
    required this.createdAt,
  });

  factory AIProvider.fromJson(Map<String, dynamic> json) {
    return AIProvider(
      id: json['_id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      baseURL: json['baseURL'] as String? ?? '',
      modelName: json['modelName'] as String? ?? '',
      embeddingApiKey: json['embeddingApiKey'] as String?,
      embeddingModel: json['embeddingModel'] as String?,
      embeddingBaseURL: json['embeddingBaseURL'] as String?,
      embeddingDimensions: json['embeddingDimensions'] as int?,
      groupId: json['groupId'] as String?,
      enabled: json['enabled'] as bool? ?? true,
      isDefault: json['isDefault'] as bool? ?? false,
      createdAt: json['createdAt'] as String? ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name,
      'baseURL': baseURL,
      'modelName': modelName,
      if (embeddingApiKey != null) 'embeddingApiKey': embeddingApiKey,
      if (embeddingModel != null) 'embeddingModel': embeddingModel,
      if (embeddingBaseURL != null) 'embeddingBaseURL': embeddingBaseURL,
      if (embeddingDimensions != null) 'embeddingDimensions': embeddingDimensions,
      if (groupId != null) 'groupId': groupId,
      'enabled': enabled,
      'isDefault': isDefault,
    };
  }
}
