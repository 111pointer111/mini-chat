"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dypnsapi20170525_1 = __importStar(require("@alicloud/dypnsapi20170525")), $Dypnsapi20170525 = dypnsapi20170525_1;
const $OpenApi = __importStar(require("@alicloud/openapi-client"));
const redis_1 = __importDefault(require("../utils/redis"));
const SMS_LIMIT_PREFIX = 'sms:limit:';
const SEND_INTERVAL_SECONDS = 60; // 60 seconds between sends
class SmsService {
    constructor() {
        this.client = null;
    }
    getClient() {
        if (!this.client) {
            const config = new $OpenApi.Config({
                accessKeyId: process.env.ALIYUN_ACCESS_KEY_ID,
                accessKeySecret: process.env.ALIYUN_ACCESS_KEY_SECRET,
            });
            config.endpoint = 'dypnsapi.aliyuncs.com';
            this.client = new dypnsapi20170525_1.default(config);
        }
        return this.client;
    }
    async sendVerificationCode(phone, type) {
        // Check send frequency limit
        const limitKey = `${SMS_LIMIT_PREFIX}${type}:${phone}`;
        const lastSend = await redis_1.default.get(limitKey);
        if (lastSend) {
            const ttl = await redis_1.default.ttl(limitKey);
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
                await redis_1.default.setex(limitKey, SEND_INTERVAL_SECONDS, '1');
                return { success: true, message: '验证码已发送' };
            }
            else {
                console.error('SMS send failed:', response.body);
                return { success: false, message: response.body?.message || '发送失败' };
            }
        }
        catch (error) {
            console.error('SMS service error:', error);
            return { success: false, message: error.message || '短信服务异常' };
        }
    }
    async verifyCode(phone, code, _type) {
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
        }
        catch (error) {
            console.error('SMS verify error:', error);
            return false;
        }
    }
}
exports.default = new SmsService();
