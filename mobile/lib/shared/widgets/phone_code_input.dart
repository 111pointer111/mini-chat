import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../providers/auth_provider.dart';

class PhoneCodeInput extends ConsumerStatefulWidget {
  final TextEditingController phoneController;
  final TextEditingController codeController;
  final String codeType; // 'register', 'login', 'bind', 'reset'

  const PhoneCodeInput({
    super.key,
    required this.phoneController,
    required this.codeController,
    required this.codeType,
  });

  @override
  ConsumerState<PhoneCodeInput> createState() => _PhoneCodeInputState();
}

class _PhoneCodeInputState extends ConsumerState<PhoneCodeInput> {
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

  Future<void> _sendCode() async {
    try {
      await ref.read(authApiProvider).sendCode(
            widget.phoneController.text.trim(),
            widget.codeType,
          );
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
          controller: widget.phoneController,
          decoration: const InputDecoration(
            hintText: '手机号',
            prefixIcon: Icon(Icons.phone_outlined),
          ),
          keyboardType: TextInputType.phone,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: TextField(
                controller: widget.codeController,
                decoration: const InputDecoration(
                  hintText: '验证码',
                  prefixIcon: Icon(Icons.sms_outlined),
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
