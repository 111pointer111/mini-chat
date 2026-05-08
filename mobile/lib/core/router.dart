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

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/',
    redirect: (context, state) {
      final isLoggedIn = authState.valueOrNull != null;
      final isAuthPage = state.matchedLocation == '/login' ||
          state.matchedLocation == '/register' ||
          state.matchedLocation == '/reset-password';

      if (!isLoggedIn && !isAuthPage) return '/login';
      if (isLoggedIn && isAuthPage) return '/';
      return null;
    },
    routes: [
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
    ],
  );
});
