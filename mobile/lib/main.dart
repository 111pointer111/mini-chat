import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/theme.dart';
import 'core/router.dart';
import 'data/services/database_service.dart';
import 'providers/auth_provider.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  // 初始化 SQLite 数据库
  await DatabaseService().database;
  
  runApp(const ProviderScope(child: BoltChatApp()));
}

class BoltChatApp extends ConsumerStatefulWidget {
  const BoltChatApp({super.key});

  @override
  ConsumerState<BoltChatApp> createState() => _BoltChatAppState();
}

class _BoltChatAppState extends ConsumerState<BoltChatApp>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      // App 回到前台 - 静默刷新用户数据并重新连接 Socket
      _onAppResumed();
    }
  }

  void _onAppResumed() {
    // 静默刷新用户数据（不显示加载状态）
    ref.read(authStateProvider.notifier).refreshSilently();

    // 重新连接 Socket
    final socketService = ref.read(socketServiceProvider);
    final token = ref.read(tokenProvider);
    if (token != null) {
      socketService.reconnect();
    }
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'BoltChat',
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.system,
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
