import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import '../../../core/theme.dart';
import '../../../data/services/app_update_service.dart';

class AppUpdatePrompt {
  static const Duration _autoCheckCooldown = Duration(minutes: 30);
  static bool _isShowing = false;
  static DateTime? _lastAutoCheckedAt;

  const AppUpdatePrompt._();

  static Future<void> check(
    BuildContext context,
    WidgetRef ref, {
    bool manual = false,
  }) async {
    final now = DateTime.now();
    if (!manual &&
        _lastAutoCheckedAt != null &&
        now.difference(_lastAutoCheckedAt!) < _autoCheckCooldown) {
      debugPrint('[AppUpdate] auto check skipped by cooldown');
      return;
    }

    if (!manual) {
      _lastAutoCheckedAt = now;
    }

    try {
      final update = await ref.read(appUpdateServiceProvider).checkForUpdate();
      if (!context.mounted) return;

      if (update == null) {
        if (manual) {
          _showMessage(context, '已是最新版本');
        }
        return;
      }

      _showUpdateDialog(context, ref, update);
    } on DioException catch (error) {
      if (manual && context.mounted) {
        _showMessage(context, '检查更新失败，请稍后重试');
      }
      debugPrint('[AppUpdate] check failed: $error');
    } catch (error) {
      if (manual && context.mounted) {
        _showMessage(context, '检查更新失败，请稍后重试');
      }
      debugPrint('[AppUpdate] check failed: $error');
    }
  }

  static void _showUpdateDialog(
    BuildContext context,
    WidgetRef ref,
    AppUpdateInfo update,
  ) {
    if (_isShowing) return;
    _isShowing = true;

    unawaited(
      showDialog<void>(
        context: context,
        barrierDismissible: !update.forceUpdate,
        builder: (dialogContext) {
          final dialog = AlertDialog(
            title: Text(
              '发现新版本 ${update.latestVersionName}',
              style: GoogleFonts.inter(fontWeight: FontWeight.w700),
            ),
            content: Text(
              update.releaseNotes.isEmpty
                  ? '新版本已经准备好，建议立即更新。'
                  : update.releaseNotes,
              style: GoogleFonts.inter(height: 1.5),
            ),
            actions: [
              if (!update.forceUpdate)
                TextButton(
                  onPressed: () => Navigator.of(dialogContext).pop(),
                  child: const Text('稍后'),
                ),
              ElevatedButton(
                onPressed: () {
                  Navigator.of(dialogContext).pop();
                  unawaited(_downloadAndInstall(context, ref, update));
                },
                child: const Text('立即更新'),
              ),
            ],
          );

          return PopScope(
            canPop: !update.forceUpdate,
            child: dialog,
          );
        },
      ).whenComplete(() {
        _isShowing = false;
      }),
    );
  }

  static Future<void> _downloadAndInstall(
    BuildContext context,
    WidgetRef ref,
    AppUpdateInfo update,
  ) async {
    var progress = 0.0;
    StateSetter? setDialogState;
    var progressDialogOpen = true;

    void closeProgressDialog() {
      if (!context.mounted || !progressDialogOpen) return;
      progressDialogOpen = false;
      Navigator.of(context, rootNavigator: true).pop();
    }

    unawaited(
      showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (_) {
          return StatefulBuilder(
            builder: (context, setState) {
              setDialogState = setState;
              final percent = (progress * 100).clamp(0, 100).toStringAsFixed(0);

              return AlertDialog(
                title: Text(
                  '正在下载更新',
                  style: GoogleFonts.inter(fontWeight: FontWeight.w700),
                ),
                content: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    LinearProgressIndicator(
                      value: progress > 0 ? progress : null,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      progress > 0 ? '$percent%' : '准备下载...',
                      style: GoogleFonts.inter(
                        color: AppThemeHelper.textSecondary(context),
                      ),
                    ),
                  ],
                ),
              );
            },
          );
        },
      ).whenComplete(() {
        progressDialogOpen = false;
      }),
    );

    try {
      await Future<void>.delayed(Duration.zero);

      final apkPath = await ref.read(appUpdateServiceProvider).downloadApk(
        update,
        onProgress: (received, total) {
          if (total <= 0) return;
          setDialogState?.call(() {
            progress = received / total;
          });
        },
      );

      closeProgressDialog();

      final openedInstaller =
          await ref.read(appUpdateServiceProvider).installApk(apkPath);
      if (!context.mounted) return;

      if (!openedInstaller) {
        _showInstallRetryMessage(context, ref, apkPath);
      }
    } on DioException catch (error) {
      closeProgressDialog();
      if (context.mounted) {
        _showMessage(context, '更新下载失败，请稍后重试');
      }
      debugPrint('[AppUpdate] download failed: $error');
    } catch (error) {
      closeProgressDialog();
      if (context.mounted) {
        _showMessage(context, '更新安装失败，请稍后重试');
      }
      debugPrint('[AppUpdate] install failed: $error');
    }
  }

  static void _showMessage(BuildContext context, String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(message)),
    );
  }

  static void _showInstallRetryMessage(
    BuildContext context,
    WidgetRef ref,
    String apkPath,
  ) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('请允许安装未知应用后继续安装'),
        action: SnackBarAction(
          label: '继续安装',
          onPressed: () {
            unawaited(_retryInstall(context, ref, apkPath));
          },
        ),
        duration: const Duration(minutes: 5),
      ),
    );
  }

  static Future<void> _retryInstall(
    BuildContext context,
    WidgetRef ref,
    String apkPath,
  ) async {
    try {
      final openedInstaller =
          await ref.read(appUpdateServiceProvider).installApk(apkPath);
      if (!context.mounted) return;
      if (!openedInstaller) {
        _showInstallRetryMessage(context, ref, apkPath);
      }
    } catch (error) {
      if (context.mounted) {
        _showMessage(context, '更新安装失败，请稍后重试');
      }
      debugPrint('[AppUpdate] retry install failed: $error');
    }
  }
}
