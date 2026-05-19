import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/auth_provider.dart';

class EmailCodeInput extends ConsumerStatefulWidget {
  final TextEditingController emailController;
  final TextEditingController codeController;
  final String codeType; // 'register', 'login', 'bind', 'reset'

  const EmailCodeInput({
    super.key,
    required this.emailController,
    required this.codeController,
    required this.codeType,
  });

  @override
  ConsumerState<EmailCodeInput> createState() => _EmailCodeInputState();
}

class _EmailCodeInputState extends ConsumerState<EmailCodeInput> {
  int _countdown = 0;
  Timer? _timer;

  void _startCountdown() {
    setState(() => _countdown = 60);
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (_countdown <= 1) {
        timer.cancel();
        setState(() => _countdown = 0);
      } else {
        setState(() => _countdown--);
      }
    });
  }

  bool _isValidEmail(String email) {
    return RegExp(r'^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$').hasMatch(email);
  }

  Future<void> _sendCode() async {
    final email = widget.emailController.text.trim();
    if (email.isEmpty) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('请先输入邮箱')),
        );
      }
      return;
    }
    if (!_isValidEmail(email)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('请输入正确的邮箱地址')),
        );
      }
      return;
    }
    try {
      await ref.read(authApiProvider).sendVerificationEmail(email, widget.codeType);
      _startCountdown();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('验证码已发送')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('发送失败: ${e.toString()}')),
        );
      }
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        TextField(
          controller: widget.emailController,
          decoration: const InputDecoration(
            hintText: '邮箱地址',
            prefixIcon: Icon(Icons.email_outlined),
          ),
          keyboardType: TextInputType.emailAddress,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: widget.codeController,
                decoration: const InputDecoration(
                  hintText: '验证码',
                  prefixIcon: Icon(Icons.mark_email_read_outlined),
                ),
                keyboardType: TextInputType.number,
              ),
            ),
            const SizedBox(width: 12),
            SizedBox(
              width: 120,
              child: OutlinedButton(
                onPressed: _countdown > 0 ? null : _sendCode,
                child: Text(
                  _countdown > 0 ? '${_countdown}s' : '发送验证码',
                  style: const TextStyle(fontSize: 13),
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
