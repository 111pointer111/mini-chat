import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme.dart';
import '../../providers/ai_provider_provider.dart';
import '../../data/models/ai_provider.dart';

class AIProviderSelector extends ConsumerWidget {
  const AIProviderSelector({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final providersAsync = ref.watch(aiProvidersProvider);
    final userProviderAsync = ref.watch(userAIProviderProvider);

    return providersAsync.when(
      data: (providers) {
        final current = userProviderAsync.valueOrNull;
        final displayName = current?.modelName ?? (providers.isNotEmpty ? providers.first.modelName : '选择模型');

        return GestureDetector(
          onTap: () => _showSelector(context, ref, providers, current?.id),
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withAlpha(180),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppTheme.primary.withAlpha(80)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.circle, size: 8, color: Colors.green),
                const SizedBox(width: 6),
                Flexible(
                  child: Text(
                    displayName,
                    style: const TextStyle(
                      fontSize: 13,
                      color: AppTheme.textPrimary,
                      fontWeight: FontWeight.w500,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
                const SizedBox(width: 4),
                const Icon(Icons.keyboard_arrow_down, size: 16),
              ],
            ),
          ),
        );
      },
      loading: () => const SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(strokeWidth: 2)),
      error: (_, __) => const SizedBox.shrink(),
    );
  }

  void _showSelector(
    BuildContext context,
    WidgetRef ref,
    List<AIProvider> providers,
    String? currentId,
  ) {
    showModalBottomSheet(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Padding(
                padding: EdgeInsets.all(16),
                child: Text(
                  '选择 AI 模型',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w600),
                ),
              ),
              const Divider(height: 1),
              ...providers.map((p) {
                final isSelected = p.id == currentId;
                return ListTile(
                  leading: Icon(
                    Icons.circle,
                    size: 10,
                    color: p.enabled ? Colors.green : Colors.grey,
                  ),
                  title: Text(
                    p.name,
                    style: TextStyle(
                      fontWeight:
                          isSelected ? FontWeight.w600 : FontWeight.normal,
                      color: isSelected ? AppTheme.primary : null,
                    ),
                  ),
                  subtitle: Text(
                    p.modelName,
                    style: const TextStyle(fontSize: 12),
                  ),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (p.isDefault)
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppTheme.primary.withAlpha(25),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text('默认',
                              style: TextStyle(
                                  fontSize: 10, color: AppTheme.primary)),
                        ),
                      if (isSelected) ...[
                        const SizedBox(width: 8),
                        const Icon(Icons.check,
                            color: AppTheme.primary, size: 20),
                      ],
                    ],
                  ),
                  enabled: p.enabled,
                  onTap: () {
                    ref
                        .read(userAIProviderProvider.notifier)
                        .selectProvider(p.id);
                    Navigator.pop(ctx);
                  },
                );
              }),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }
}
