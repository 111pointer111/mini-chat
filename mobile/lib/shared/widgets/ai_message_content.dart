import 'package:flutter/material.dart';
import 'package:flutter_markdown/flutter_markdown.dart';

import '../../core/theme.dart';
import '../utils/ai_message_parser.dart';

class AIMessageContent extends StatelessWidget {
  final String content;
  final String? thinking;
  final Color? textColor;
  final Color? accentColor;
  final bool isStreaming;
  final String? emptyFallback;

  const AIMessageContent({
    super.key,
    required this.content,
    this.thinking,
    this.textColor,
    this.accentColor,
    this.isStreaming = false,
    this.emptyFallback,
  });

  @override
  Widget build(BuildContext context) {
    final parsed = parseAIMessageContent(content);
    final resolvedThinking = _nonEmpty(thinking) ?? parsed.thinking;
    final resolvedContent = parsed.content;
    final effectiveTextColor = textColor ?? AppThemeHelper.textPrimary(context);
    final effectiveAccentColor = accentColor ?? AppColors.primary;
    final fallbackText = _nonEmpty(emptyFallback) ??
        (isStreaming ? '正在思考...' : '（AI 未返回内容，请重试）');

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (resolvedThinking != null) ...[
          AIThinkingBlock(
            thinking: resolvedThinking,
            accentColor: effectiveAccentColor,
            initiallyExpanded: isStreaming,
          ),
          if (resolvedContent.isNotEmpty) const SizedBox(height: 8),
        ],
        if (resolvedContent.isNotEmpty)
          MarkdownBody(
            data: resolvedContent,
            styleSheet: buildAIMessageMarkdownStyleSheet(
              context,
              textColor: effectiveTextColor,
              accentColor: effectiveAccentColor,
            ),
          )
        else if (resolvedThinking == null || isStreaming)
          Text(
            fallbackText,
            style: TextStyle(
              fontSize: 14,
              color: AppThemeHelper.textSecondary(context),
              fontStyle: FontStyle.italic,
              height: 1.45,
            ),
          ),
      ],
    );
  }
}

class AIThinkingBlock extends StatefulWidget {
  final String thinking;
  final Color accentColor;
  final bool initiallyExpanded;

  const AIThinkingBlock({
    super.key,
    required this.thinking,
    required this.accentColor,
    this.initiallyExpanded = false,
  });

  @override
  State<AIThinkingBlock> createState() => _AIThinkingBlockState();
}

class _AIThinkingBlockState extends State<AIThinkingBlock> {
  late bool _expanded;

  @override
  void initState() {
    super.initState();
    _expanded = widget.initiallyExpanded;
  }

  @override
  Widget build(BuildContext context) {
    final accent = widget.accentColor;
    final backgroundColor = accent.withAlpha(18);
    final borderColor = accent.withAlpha(70);

    return Container(
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: borderColor),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            onTap: () => setState(() => _expanded = !_expanded),
            borderRadius: BorderRadius.circular(8),
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    _expanded
                        ? Icons.keyboard_arrow_down
                        : Icons.keyboard_arrow_right,
                    size: 18,
                    color: accent,
                  ),
                  const SizedBox(width: 4),
                  Text(
                    '思考过程',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                      color: accent,
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (_expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 0, 10, 8),
              child: MarkdownBody(
                data: widget.thinking,
                styleSheet: buildAIMessageMarkdownStyleSheet(
                  context,
                  textColor: AppThemeHelper.textSecondary(context),
                  accentColor: accent,
                  fontSize: 12,
                ),
              ),
            ),
        ],
      ),
    );
  }
}

MarkdownStyleSheet buildAIMessageMarkdownStyleSheet(
  BuildContext context, {
  required Color textColor,
  required Color accentColor,
  double fontSize = 14,
}) {
  return MarkdownStyleSheet(
    p: TextStyle(fontSize: fontSize, color: textColor, height: 1.55),
    code: TextStyle(
      fontSize: fontSize - 1,
      color: accentColor,
      backgroundColor: accentColor.withAlpha(18),
    ),
    codeblockDecoration: BoxDecoration(
      color: AppThemeHelper.isDark(context)
          ? Colors.white.withAlpha(18)
          : Colors.black.withAlpha(10),
      borderRadius: BorderRadius.circular(8),
    ),
    blockquoteDecoration: BoxDecoration(
      border: Border(left: BorderSide(color: accentColor, width: 3)),
    ),
    blockquotePadding: const EdgeInsets.only(left: 12),
    h1: TextStyle(
      fontSize: fontSize + 6,
      fontWeight: FontWeight.bold,
      color: textColor,
    ),
    h2: TextStyle(
      fontSize: fontSize + 4,
      fontWeight: FontWeight.bold,
      color: textColor,
    ),
    h3: TextStyle(
      fontSize: fontSize + 2,
      fontWeight: FontWeight.w600,
      color: textColor,
    ),
  );
}

String? _nonEmpty(String? value) {
  final trimmed = value?.trim();
  return trimmed == null || trimmed.isEmpty ? null : trimmed;
}
