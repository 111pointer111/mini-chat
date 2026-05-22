import 'package:intl/intl.dart';

String formatMessageTime(String isoString) {
  final parsed = DateTime.tryParse(isoString);
  if (parsed == null) return isoString;
  final date = parsed.toLocal();
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final messageDay = DateTime(date.year, date.month, date.day);

  if (messageDay == today) {
    return DateFormat('HH:mm').format(date);
  } else if (messageDay == today.subtract(const Duration(days: 1))) {
    return '昨天 ${DateFormat('HH:mm').format(date)}';
  } else if (now.year == date.year) {
    return DateFormat('MM/dd HH:mm').format(date);
  } else {
    return DateFormat('yyyy/MM/dd HH:mm').format(date);
  }
}

String formatTaskTime(String isoString) {
  final parsed = DateTime.tryParse(isoString);
  if (parsed == null) return isoString;
  final date = parsed.toLocal();
  return DateFormat('yyyy-MM-dd HH:mm').format(date);
}
