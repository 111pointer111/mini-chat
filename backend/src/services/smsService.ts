import Dypnsapi20170525, * as $Dypnsapi20170525 from '@alicloud/dypnsapi20170525';
import * as $OpenApi from '@alicloud/openapi-client';
import redis from '../utils/redis';

const SMS_LIMIT_PREFIX = 'sms:limit:';
const SEND_INTERVAL_SECONDS = 60; // 60 seconds between sends

class SmsService {
    private client: Dypnsapi20170525 | null = null;

    private getClient(): Dypnsapi20170525 {
        if (!this.client) {
            const config = new $OpenApi.Config({
                accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
                accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
            });
            config.endpoint = 'dypnsapi.aliyuncs.com';
            this.client = new Dypnsapi20170525(config);
        }
        return this.client;
    }

    async sendVerificationCode(phone: string, type: 'register' | 'login' | 'bind' | 'reset'): Promise<{ success: boolean; message: string }> {
        // Check send frequency limit
        const limitKey = `${SMS_LIMIT_PREFIX}${type}:${phone}`;
        const lastSend = await redis.get(limitKey);
        if (lastSend) {
            const ttl = await redis.ttl(limitKey);
            return { success: false, message: `请${ttl}秒后再试` };
        }

        try {
            const request = new $Dypnsapi20170525.SendSmsVerifyCodeRequest({
                phoneNumber: phone,
                signName: process.env.ALIYUN_SMS_SIGN_NAME,
                templateCode: process.env.ALIYUN_SMS_TEMPLATE_CODE,
                templateParam: '{"code":"##code##","min":"5"}',
            });

            const response = await this.getClient().sendSmsVerifyCode(request);

            if (response.body?.code === 'OK' && response.body?.success) {
                // Set send limit
                await redis.setex(limitKey, SEND_INTERVAL_SECONDS, '1');
                return { success: true, message: '验证码已发送' };
            } else {
                console.error('SMS send failed:', response.body);
                return { success: false, message: response.body?.message || '发送失败' };
            }
        } catch (error: any) {
            console.error('SMS service error:', error);
            return { success: false, message: error.message || '短信服务异常' };
        }
    }

    async verifyCode(phone: string, code: string, _type: 'register' | 'login' | 'bind' | 'reset'): Promise<boolean> {
        try {
            const request = new $Dypnsapi20170525.CheckSmsVerifyCodeRequest({
                phoneNumber: phone,
                verifyCode: code,
            });

            const response = await this.getClient().checkSmsVerifyCode(request);

            if (response.body?.code === 'OK' && response.body?.model?.verifyResult === 'PASS') {
                return true;
            }
            return false;
        } catch (error: any) {
            console.error('SMS verify error:', error);
            return false;
        }
    }
}

export default new SmsService();
