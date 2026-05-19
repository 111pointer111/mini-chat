import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../providers/auth_provider.dart';
import '../features/auth/login_screen.dart';
import '../features/auth/register_screen.dart';
import '../features/auth/reset_password_screen.dart';
import '../features/dashboard/dashboard_screen.dart';
import '../features/ai_chat/ai_chat_screen.dart';
import '../features/scheduled_tasks/scheduled_tasks_screen.dart';
import '../features/knowledge_base/knowledge_base_screen.dart';
import '../features/mcp_tools/mcp_tools_screen.dart';
import '../features/admin/admin_ai_providers_screen.dart';
import '../features/group/group_list_screen.dart';
import '../features/group/create_group_screen.dart';
import '../features/group/group_chat_screen.dart';
import '../features/group/group_settings_screen.dart';
import '../features/group/group_kb_screen.dart';

class LoadingScreen extends StatelessWidget {
  const LoadingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: CircularProgressIndicator(),
      ),
    );
  }
}

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final isLoading = authState.isLoading;
      final isLoggedIn = authState.valueOrNull != null;
      final isAuthPage = state.matchedLocation == '/login' ||
          state.matchedLocation == '/register' ||
          state.matchedLocation == '/reset-password';
      final isLoadingPage = state.matchedLocation == '/loading';

      // 还在加载中，显示加载页面
      if (isLoading && !isLoadingPage) return '/loading';

      // 加载完成，从 loading 页面跳转
      if (!isLoading && isLoadingPage) {
        return isLoggedIn ? '/' : '/login';
      }

      if (!isLoggedIn && !isAuthPage) return '/login';
      if (isLoggedIn && isAuthPage) return '/';
      return null;
    },
    routes: [
      GoRoute(
        path: '/loading',
        builder: (context, state) => const LoadingScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/register',
        builder: (context, state) => const RegisterScreen(),
      ),
      GoRoute(
        path: '/reset-password',
        builder: (context, state) => const ResetPasswordScreen(),
      ),
      GoRoute(
        path: '/',
        builder: (context, state) => const DashboardScreen(),
      ),
      GoRoute(
        path: '/ai-chat',
        builder: (context, state) => const AIChatScreen(),
      ),
      GoRoute(
        path: '/scheduled-tasks',
        builder: (context, state) => const ScheduledTasksScreen(),
      ),
      GoRoute(
        path: '/knowledge-base',
        builder: (context, state) => const KnowledgeBaseScreen(),
      ),
      GoRoute(
        path: '/mcp-tools',
        builder: (context, state) => const MCPToolsScreen(),
      ),
      GoRoute(
        path: '/admin/ai-providers',
        builder: (context, state) => const AdminAIProvidersScreen(),
      ),
      // 群聊相关路由
      GoRoute(
        path: '/groups',
        builder: (context, state) => const GroupListScreen(),
      ),
      GoRoute(
        path: '/groups/create',
        builder: (context, state) => const CreateGroupScreen(),
      ),
      GoRoute(
        path: '/groups/:id',
        builder: (context, state) => GroupChatScreen(
          groupId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/groups/:id/settings',
        builder: (context, state) => GroupSettingsScreen(
          groupId: state.pathParameters['id']!,
        ),
      ),
      GoRoute(
        path: '/groups/:id/knowledge-base',
        builder: (context, state) => GroupKBScreen(
          groupId: state.pathParameters['id']!,
        ),
      ),
    ],
  );
});
