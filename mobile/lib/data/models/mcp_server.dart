class MCPTool {
  final String name;
  final String? description;
  final Map<String, dynamic>? inputSchema;

  MCPTool({
    required this.name,
    this.description,
    this.inputSchema,
  });

  factory MCPTool.fromJson(Map<String, dynamic> json) {
    return MCPTool(
      name: json['name'] as String? ?? '',
      description: json['description'] as String?,
      inputSchema: json['inputSchema'] as Map<String, dynamic>?,
    );
  }
}

class MCPServer {
  final String id;
  final String name;
  final String? description;
  final String transport; // 'http', 'sse'
  final String url;
  final List<Map<String, dynamic>> headers;
  final bool enabled;
  final List<MCPTool> cachedTools;
  final String? lastConnectedAt;
  final String? lastError;
  final String createdAt;
  final String updatedAt;

  MCPServer({
    required this.id,
    required this.name,
    this.description,
    required this.transport,
    required this.url,
    required this.headers,
    required this.enabled,
    required this.cachedTools,
    this.lastConnectedAt,
    this.lastError,
    required this.createdAt,
    required this.updatedAt,
  });

  factory MCPServer.fromJson(Map<String, dynamic> json) {
    return MCPServer(
      id: json['_id'] as String? ?? '',
      name: json['name'] as String? ?? '',
      description: json['description'] as String?,
      transport: json['transport'] as String? ?? 'http',
      url: json['url'] as String? ?? '',
      headers: (json['headers'] as List<dynamic>?)
              ?.map((e) => e as Map<String, dynamic>)
              .toList() ??
          [],
      enabled: json['enabled'] as bool? ?? true,
      cachedTools: (json['cachedTools'] as List<dynamic>?)
              ?.map((e) => MCPTool.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      lastConnectedAt: json['lastConnectedAt'] as String?,
      lastError: json['lastError'] as String?,
      createdAt: json['createdAt'] as String? ?? '',
      updatedAt: json['updatedAt'] as String? ?? '',
    );
  }
}
