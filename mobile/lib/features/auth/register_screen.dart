import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme.dart';
import '../../data/models/user.dart';
import '../../providers/auth_provider.dart';
import '../../shared/widgets/phone_code_input.dart';

class RegisterScreen extends ConsumerStatefulWidget {
  const RegisterScreen({super.key});

  @override
  ConsumerState<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends ConsumerState<RegisterScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _usernameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _phoneController = TextEditingController();
  final _codeController = TextEditingController();
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _usernameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _phoneController.dispose();
    _codeController.dispose();
    super.dispose();
  }

  Future<void> _registerWithEmail() async {
    setState(() => _isLoading = true);
    try {
      final res = await ref.read(authApiProvider).register(
            _usernameController.text.trim(),
            _emailController.text.trim(),
            _passwordController.text,
          );
      final data = res.data;
      final user = User.fromJson(data['user'] as Map<String, dynamic>);
      final token = data['token'] as String;
      await ref.read(authStateProvider.notifier).login(user, token);
      if (mounted) context.go('/');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('注册失败: ${e.toString()}')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _registerWithPhone() async {
    setState(() => _isLoading = true);
    try {
      final res = await ref.read(authApiProvider).registerPhone(
            _usernameController.text.trim(),
            _phoneController.text.trim(),
            _codeController.text.trim(),
          );
      final data = res.data;
      final user = User.fromJson(data['user'] as Map<String, dynamic>);
      final token = data['token'] as String;
      await ref.read(authStateProvider.notifier).login(user, token);
      if (mounted) context.go('/');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('注册失败: ${e.toString()}')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(gradient: AppTheme.backgroundGradient),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Text(
                    '创建账号',
                    style: TextStyle(
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                        color: Colors.white),
                  ),
                  const SizedBox(height: 32),
                  Card(
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        children: [
                          TabBar(
                            controller: _tabController,
                            labelColor: AppTheme.primary,
                            unselectedLabelColor: AppTheme.textSecondary,
                            indicatorColor: AppTheme.primary,
                            tabs: const [
                              Tab(text: '邮箱注册'),
                              Tab(text: '手机注册'),
                            ],
                          ),
                          const SizedBox(height: 20),
                          SizedBox(
                            height: 300,
                            child: TabBarView(
                              controller: _tabController,
                              children: [
                                _buildEmailTab(),
                                _buildPhoneTab(),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () => context.go('/login'),
                    child: const Text('已有账号？立即登录',
                        style: TextStyle(color: Colors.white)),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildEmailTab() {
    return Column(
      children: [
        TextField(
          controller: _usernameController,
          decoration: const InputDecoration(
            hintText: '用户名',
            prefixIcon: Icon(Icons.person_outlined),
          ),
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _emailController,
          decoration: const InputDecoration(
            hintText: '邮箱地址',
            prefixIcon: Icon(Icons.email_outlined),
          ),
          keyboardType: TextInputType.emailAddress,
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _passwordController,
          decoration: const InputDecoration(
            hintText: '密码',
            prefixIcon: Icon(Icons.lock_outlined),
          ),
          obscureText: true,
        ),
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _registerWithEmail,
            child: _isLoading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Text('注册'),
          ),
        ),
      ],
    );
  }

  Widget _buildPhoneTab() {
    return Column(
      children: [
        TextField(
          controller: _usernameController,
          decoration: const InputDecoration(
            hintText: '用户名',
            prefixIcon: Icon(Icons.person_outlined),
          ),
        ),
        const SizedBox(height: 12),
        PhoneCodeInput(
          phoneController: _phoneController,
          codeController: _codeController,
          codeType: 'register',
        ),
        const SizedBox(height: 20),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton(
            onPressed: _isLoading ? null : _registerWithPhone,
            child: _isLoading
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(
                        strokeWidth: 2, color: Colors.white))
                : const Text('注册'),
          ),
        ),
      ],
    );
  }
}
