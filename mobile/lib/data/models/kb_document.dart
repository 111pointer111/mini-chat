class KBDocument {
  final int id;
  final String title;
  final String source; // 'local', 'url'
  final String? fileType;
  final int chunkCount;
  final String status; // 'processing', 'ready', 'failed'
  final String? errorMsg;
  final String createdAt;

  KBDocument({
    required this.id,
    required this.title,
    required this.source,
    this.fileType,
    required this.chunkCount,
    required this.status,
    this.errorMsg,
    required this.createdAt,
  });

  factory KBDocument.fromJson(Map<String, dynamic> json) {
    return KBDocument(
      id: json['id'] as int,
      title: json['title'] as String? ?? '',
      source: json['source'] as String? ?? 'local',
      fileType: json['file_type'] as String?,
      chunkCount: json['chunk_count'] as int? ?? 0,
      status: json['status'] as String? ?? 'processing',
      errorMsg: json['error_msg'] as String?,
      createdAt: json['created_at'] as String? ?? '',
    );
  }
}
