class ParsedAIMessage {
  final String content;
  final String? thinking;

  const ParsedAIMessage({
    required this.content,
    this.thinking,
  });
}

final _thinkBlockRegex = RegExp(
  r'<think>([\s\S]*?)</think>',
  caseSensitive: false,
);
final _thinkOpenRegex = RegExp(r'<think>', caseSensitive: false);

ParsedAIMessage parseAIMessageContent(String rawContent) {
  final matches = _thinkBlockRegex.allMatches(rawContent).toList();
  if (matches.isEmpty) {
    final openMatch = _thinkOpenRegex.firstMatch(rawContent);
    if (openMatch != null) {
      final content = rawContent.substring(0, openMatch.start).trim();
      final thinking = rawContent.substring(openMatch.end).trim();
      return ParsedAIMessage(
        content: content,
        thinking: thinking.isEmpty ? null : thinking,
      );
    }

    return ParsedAIMessage(content: rawContent.trim());
  }

  final thinking = matches
      .map((match) => match.group(1)?.trim() ?? '')
      .where((part) => part.isNotEmpty)
      .join('\n\n');

  return ParsedAIMessage(
    content: rawContent.replaceAll(_thinkBlockRegex, '').trim(),
    thinking: thinking.isEmpty ? null : thinking,
  );
}
