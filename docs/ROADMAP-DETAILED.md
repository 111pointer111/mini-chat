# Mini-Chat 功能规划文档（详细版）

## 项目愿景

打造一个功能丰富的智能聊天平台，支持多种登录方式、AI 对话、图片消息、语音消息、群聊游戏和定时任务。

---

## 一、登录认证系统

### 1.1 手机号登录 ⭐ 优先级：高

**需求背景**：
- 手机号是国内最通用的身份标识
- 用户无需记忆密码，验证码登录更便捷
- 为找回密码功能提供基础

**功能清单**：
- [ ] 短信验证码发送
- [ ] 手机号注册
- [ ] 手机号登录
- [ ] 手机号绑定（已有账号绑定手机）

**实现方案**：

```
后端改动：
├── models/User.ts          # 添加 phone 字段
├── services/smsService.ts  # 新建，封装短信发送逻辑
├── controllers/authController.ts
│   ├── sendSmsCode()       # 发送验证码
│   ├── registerByPhone()   # 手机号注册
│   └── loginByPhone()      # 手机号登录
├── routes/authRoutes.ts    # 新增路由
└── utils/redis.ts          # 验证码存储（5分钟过期）

前端改动：
├── pages/Login.tsx         # 添加手机号登录 Tab
├── pages/Register.tsx      # 添加手机号注册选项
└── components/PhoneCodeInput.tsx  # 新建，手机号+验证码输入组件

技术选型：
- 短信服务商：阿里云短信 / 腾讯云短信
- 验证码存储：Redis（key: sms:{type}:{phone}, TTL: 300s）
- 发送频率限制：同一手机号 60 秒内只能发一次
```

**API 设计**：
| 接口 | 方法 | 描述 |
|------|------|------|
| /api/auth/send-code | POST | 发送验证码 |
| /api/auth/register-phone | POST | 手机号注册 |
| /api/auth/login-phone | POST | 手机号登录 |
| /api/auth/bind-phone | POST | 绑定手机号 |

---

### 1.2 QQ 登录 ⭐ 优先级：中

**需求背景**：
- QQ 用户基数大，一键登录提升体验
- 个人开发者可申请 QQ 互联

**功能清单**：
- [ ] QQ 互联 OAuth 2.0 接入
- [ ] QQ 账号关联/绑定
- [ ] 获取 QQ 头像和昵称

**实现方案**：

```
流程：
用户点击QQ登录 → 跳转QQ授权页 → 用户同意 → 回调带code 
→ 后端换取access_token → 获取用户信息 → 创建/关联账号

后端改动：
├── models/User.ts          # 添加 qqOpenId 字段
├── services/qqAuthService.ts  # 新建，QQ OAuth 逻辑
├── controllers/authController.ts
│   ├── qqLogin()           # 生成授权 URL
│   └── qqCallback()        # 处理回调
└── routes/authRoutes.ts    # 新增路由

前端改动：
├── pages/Login.tsx         # 添加 QQ 登录按钮
└── pages/QQCallback.tsx    # 新建，处理回调页面

需要申请：
- QQ 互联开发者账号
- 创建应用获取 AppID 和 AppKey
```

---

### 1.3 微信登录 ⭐ 优先级：低

**需求背景**：
- 微信用户量最大
- **限制**：必须企业资质，个人无法申请

**建议**：等有企业资质后再实现，实现方式与 QQ 登录类似。

---

### 1.4 找回密码

**需求背景**：
- 用户忘记密码时需要找回途径
- 前提：账号已绑定手机号或邮箱

**功能清单**：
- [ ] 通过手机号找回（发送验证码）
- [ ] 通过 QQ 邮箱找回（发送验证链接）
- [ ] 重置密码流程

**实现方案**：

```
流程（手机号）：
输入手机号 → 发送验证码 → 验证通过 → 设置新密码

流程（邮箱）：
输入邮箱 → 发送重置链接（含 token）→ 点击链接 → 设置新密码

后端改动：
├── controllers/authController.ts
│   ├── forgotPassword()    # 发送重置验证码/链接
│   └── resetPassword()     # 重置密码
├── services/emailService.ts  # 新建，邮件发送
└── routes/authRoutes.ts

前端改动：
├── pages/ForgotPassword.tsx  # 新建，找回密码页面
└── pages/ResetPassword.tsx   # 新建，重置密码页面
```

---

## 二、图片消息功能 ⭐ 优先级：高

**需求背景**：
- 聊天中发送图片是基础功能
- 图片需要云存储，减轻服务器压力
- 缩略图提升加载速度

**功能清单**：
- [ ] 聊天界面添加图片发送按钮
- [ ] 支持选择图片/拍照上传
- [ ] 图片自动压缩生成缩略图
- [ ] 点击查看原图

**实现方案**：

```
上传流程：
用户选择图片 → 前端预览 → 上传到后端 → 后端压缩生成缩略图 
→ 上传原图+缩略图到云存储 → 返回 URL → 发送消息

后端改动：
├── models/Message.ts
│   ├── type: 'text' | 'image'  # 消息类型
│   ├── imageUrl?: string       # 原图 URL
│   └── thumbnailUrl?: string   # 缩略图 URL
├── services/storageService.ts  # 新建，云存储操作
├── services/imageService.ts    # 新建，图片压缩（sharp）
├── controllers/uploadController.ts  # 新建
└── routes/uploadRoutes.ts      # 新建

前端改动：
├── components/ChatInput.tsx    # 添加图片按钮
├── components/ImageMessage.tsx # 新建，图片消息组件
└── components/ImageViewer.tsx  # 新建，大图查看器

技术选型：
- 云存储：Cloudflare R2（免费出站流量）或 阿里云 OSS
- 图片压缩：sharp（Node.js）
- 缩略图尺寸：宽度 300px 等比缩放
```

**API 设计**：
| 接口 | 方法 | 描述 |
|------|------|------|
| /api/upload/image | POST | 上传图片，返回原图和缩略图 URL |

---

## 三、语音消息功能 ⭐ 优先级：中

**需求背景**：
- 语音输入比打字更方便
- 语音转文字方便查看
- 提升聊天体验

**功能清单**：
- [ ] 语音录制发送
- [ ] 语音播放
- [ ] 语音转文字（可选）
- [ ] 文字转语音播放（可选）

**实现方案**：

```
录音流程：
按住录音按钮 → 录制音频 → 松开上传 → 云存储 → 发送消息

后端改动：
├── models/Message.ts
│   ├── type: 'text' | 'image' | 'voice'
│   ├── audioUrl?: string       # 音频 URL
│   ├── duration?: number       # 时长（秒）
│   └── transcript?: string     # 转写文字
├── services/whisperService.ts  # 新建，语音转文字
├── controllers/uploadController.ts  # 添加音频上传
└── routes/uploadRoutes.ts

前端改动：
├── components/ChatInput.tsx    # 添加录音按钮
├── components/VoiceMessage.tsx # 新建，语音消息组件
└── hooks/useAudioRecorder.ts   # 新建，录音 Hook

技术选型：
- 前端录音：Web Audio API / react-media-recorder
- 音频格式：WebM / MP3
- 语音转文字：OpenAI Whisper API
- 云存储：复用图片的云存储
```

**API 设计**：
| 接口 | 方法 | 描述 |
|------|------|------|
| /api/upload/audio | POST | 上传音频，返回 URL |
| /api/transcribe | POST | 语音转文字（可选） |

---

## 四、AI 机器人系统 ⭐ 优先级：高

**需求背景**：
- 不同场景需要不同风格的 AI
- 用户可以创建多个 AI 聊天窗口
- 每个窗口可选择不同角色

**功能清单**：
- [ ] 支持创建多个 AI 聊天窗口
- [ ] 预设机器人角色选择
- [ ] 角色独立对话历史
- [ ] 用户自定义角色（高级）

**预设角色**：
| 角色 | 描述 | 系统提示词特点 |
|------|------|---------------|
| 通用助手 | 默认 AI | 通用问答 |
| 机器人女友 | 虚拟伴侣 | 温柔、情感陪伴 |
| 淘宝客服 | 电商客服 | 商品咨询、售后 |
| 英语老师 | 学习助手 | 纠错、翻译 |
| 代码助手 | 编程辅助 | 代码解释 |
| 心理咨询师 | 情感倾诉 | 倾听、开导 |
| 健身教练 | 运动指导 | 训练计划 |
| 面试官 | 模拟面试 | 提问、反馈 |

**实现方案**：

```
后端改动：
├── models/AIBot.ts           # 新建，机器人模型
│   ├── name: string
│   ├── avatar: string
│   ├── systemPrompt: string
│   ├── isPreset: boolean
│   └── createdBy?: ObjectId
├── models/AIConversation.ts  # 新建，AI 对话模型
│   ├── userId: ObjectId
│   ├── botId: ObjectId
│   └── messages: Message[]
├── controllers/aiBotController.ts
│   ├── listBots()            # 获取机器人列表
│   ├── createBot()           # 创建自定义机器人
│   └── chat()                # 发送消息
└── routes/aiBotRoutes.ts

前端改动：
├── pages/AIChat.tsx          # AI 聊天页面
├── components/BotSelector.tsx # 机器人选择器
├── components/BotCard.tsx    # 机器人卡片
└── store/aiBotStore.ts       # AI 状态管理

数据预置：
- 在数据库中预置 8 个默认机器人角色
- 每个角色有独立的 systemPrompt
```

---

## 五、群聊与 AI 游戏助手 ⭐ 优先级：高（创意功能）

**需求背景**：
- 群聊是社交基础功能
- AI 助手可以组织桌游游戏（狼人杀、UNO 等）
- 私密消息支持游戏中的身份通知

**解决的问题**：
- 线上玩桌游需要组织者，AI 可以担任
- 游戏中需要私密通知（如狼人身份），需要私密消息支持
- 通用游戏引擎可以支持多种桌游

**功能清单**：
- [ ] 创建群组
- [ ] 邀请好友加入
- [ ] 群消息发送
- [ ] 私密消息（只有指定成员可见）
- [ ] AI 游戏助手
- [ ] 预设游戏（狼人杀、猜数字等）

**实现方案**：

```
数据模型：

// 群组
Group {
  id: ObjectId
  name: string
  avatar: string
  ownerId: ObjectId
  members: ObjectId[]
  createdAt: Date
}

// 群消息（支持私密）
GroupMessage {
  id: ObjectId
  groupId: ObjectId
  senderId: ObjectId
  content: string
  type: 'text' | 'image' | 'voice' | 'system'
  visibleTo: ObjectId[]  // 空数组=所有人可见，有值=仅指定成员可见
  createdAt: Date
}

// 游戏会话
GameSession {
  id: ObjectId
  groupId: ObjectId
  gameType: string        // 'werewolf', 'guess_number', etc.
  status: 'waiting' | 'playing' | 'ended'
  players: [{
    userId: ObjectId
    role?: string         // 狼人、村民、预言家
    status: 'alive' | 'dead'
    attributes: {         // 通用属性
      hp?: number
      cards?: string[]
      skills?: string[]
    }
  }]
  gameState: any          // 游戏状态 JSON
  currentTurn: number
  createdAt: Date
}

后端改动：
├── models/Group.ts
├── models/GroupMessage.ts
├── models/GameSession.ts
├── services/gameEngine.ts    # 通用游戏引擎
│   ├── setHP(userId, value)
│   ├── setStatus(userId, status)
│   ├── giveCard(userId, card)
│   ├── useSkill(userId, skill, target)
│   ├── nextTurn()
│   └── checkWinCondition()
├── services/games/
│   ├── werewolf.ts           # 狼人杀规则
│   └── guessNumber.ts        # 猜数字规则
├── controllers/groupController.ts
├── controllers/gameController.ts
└── routes/groupRoutes.ts

前端改动：
├── pages/GroupChat.tsx
├── components/GroupMessage.tsx   # 支持私密消息显示
├── components/GamePanel.tsx      # 游戏面板
└── store/groupStore.ts

AI 游戏助手工作流程：
1. 用户 @AI助手 开始游戏
2. AI 读取游戏规则（系统提示词）
3. AI 分配角色，发送私密消息通知
4. AI 理解玩家指令，执行游戏逻辑
5. AI 发送公开/私密消息推进游戏
```

**消息可见性示例**：
```javascript
// 公开消息（所有人可见）
{ content: "游戏开始！", visibleTo: [] }

// 私密消息（仅狼人可见）
{ content: "你是狼人，队友是用户B", visibleTo: [userA_id, userB_id] }
```

---

## 六、定时任务功能 ⭐ 优先级：中

**需求背景**：
- 定时提醒、每日问候等场景
- AI 定时生成内容推送给用户

**功能清单**：
- [ ] 预设定时任务（第一阶段）
- [ ] 用户自定义任务（第二阶段）

**实现方案**：

```
第一阶段：预设任务

预设任务列表：
- 每日问候（每天 9:00）
- 周报提醒（每周五 18:00）
- 学习打卡（每天 20:00）
- 天气播报（每天 7:00）

后端改动：
├── models/ScheduledTask.ts
│   ├── userId: ObjectId
│   ├── taskType: string      # 预设任务类型
│   ├── enabled: boolean
│   ├── cron: string          # Cron 表达式
│   └── aiPrompt: string      # AI 提示词
├── services/schedulerService.ts  # 任务调度
├── controllers/taskController.ts
└── routes/taskRoutes.ts

技术选型：
- 任务调度：node-cron 或 agenda
- 任务触发时调用 AI API 生成内容
- 通过 WebSocket 推送给用户

第二阶段：自定义任务
- 用户可创建自定义任务
- 自定义触发时间
- 自定义 AI 提示词
```

---

## 七、其他功能（待定）

| 功能 | 优先级 | 描述 |
|------|--------|------|
| AI 图片生成 | 低 | 接入 DALL-E |
| 消息搜索 | 中 | 全文搜索历史消息 |
| 消息收藏 | 低 | 收藏重要消息 |
| AI 摘要 | 低 | 长对话自动总结 |
| 多语言支持 | 低 | 界面多语言 |
| 数据导出 | 低 | 导出聊天记录 |

---

## 开发阶段规划

### 第一阶段：核心功能
1. 手机号登录 + 找回密码
2. 图片消息 + 云存储
3. AI 多机器人系统

### 第二阶段：社交功能
1. 群聊基础功能
2. 私密消息支持
3. QQ 登录

### 第三阶段：高级功能
1. 语音消息
2. AI 游戏助手
3. 预设定时任务

### 第四阶段：扩展功能
1. 自定义定时任务
2. 用户自定义机器人
3. 更多桌游支持

---

## 技术栈

| 功能 | 技术方案 |
|------|----------|
| 短信服务 | 阿里云短信 / 腾讯云短信 |
| 云存储 | Cloudflare R2 / 阿里云 OSS |
| 图片处理 | sharp |
| 语音转文字 | OpenAI Whisper |
| 定时任务 | node-cron / agenda |
| OAuth | 手动实现 |
| AI | Gemini API（已有） |

---

*文档创建时间：2026-02-14*
*最后更新：2026-02-14*

---

## 八、消息搜索功能 ⭐ 优先级：中

**需求背景**：
- 聊天记录多了难以找到特定消息
- 需要快速定位历史对话

**功能清单**：
- [ ] 全文搜索历史消息
- [ ] 按时间范围筛选
- [ ] 按消息类型筛选（文字/图片/语音）
- [ ] 按聊天对象筛选
- [ ] 搜索结果高亮显示
- [ ] 点击结果跳转到原消息位置

**实现方案**：

```
后端改动：
├── controllers/messageController.ts
│   └── searchMessages()      # 搜索消息
└── routes/messageRoutes.ts

搜索方式：
- 简单方案：MongoDB $regex 正则搜索
- 高级方案：Elasticsearch 全文搜索（消息量大时）

API 设计：
GET /api/messages/search
  ?query=关键词
  &startDate=2026-01-01
  &endDate=2026-02-14
  &type=text|image|voice
  &chatId=xxx

前端改动：
├── components/SearchBar.tsx      # 搜索栏
├── components/SearchResults.tsx  # 搜索结果列表
└── pages/SearchPage.tsx          # 搜索页面
```

---

## 九、消息收藏系统 ⭐ 优先级：高（创意功能）

**需求背景**：
- 重要消息需要保存以便日后查看
- 不同类型的收藏需要不同的处理方式
- AI 可以智能处理和复习收藏内容

**解决的问题**：
- 知识点收藏后容易遗忘 → AI 定时发送复习提醒
- 账号密码记录混乱 → AI 自动格式化整理
- 收藏内容难以检索 → 分类管理 + 快速搜索

**功能清单**：
- [ ] 收藏消息到收藏夹
- [ ] 收藏分类管理
- [ ] 分类内搜索
- [ ] AI 智能处理（按分类不同处理）
- [ ] 知识点定时复习
- [ ] 账号密码格式化存储

**收藏分类设计**：

| 分类 | AI 处理方式 | 特殊功能 |
|------|------------|----------|
| 📚 知识点 | 提取要点，生成复习卡片 | 定时发送复习消息（艾宾浩斯遗忘曲线） |
| 🔐 账号密码 | 自动格式化为标准格式 | 加密存储，整齐列表展示 |
| 🔗 网站链接 | 提取标题和描述 | 分类书签管理 |
| 💡 灵感想法 | 保持原样 | 随机回顾功能 |
| 📝 待办事项 | 提取任务和截止日期 | 到期提醒 |
| 📖 阅读笔记 | 生成摘要 | 关联原文链接 |
| 🎯 目标计划 | 拆解为子目标 | 进度追踪 |
| 📦 其他 | 保持原样 | 通用收藏 |

**实现方案**：

```
数据模型：

// 收藏分类
FavoriteCategory {
  id: ObjectId
  userId: ObjectId
  name: string              # 分类名称
  icon: string              # 图标
  type: string              # 预设类型：knowledge, password, link, idea, todo, note, goal, other
  aiProcessing: {
    enabled: boolean        # 是否启用 AI 处理
    promptTemplate: string  # AI 处理提示词模板
  }
  reviewSchedule?: {        # 复习计划（知识点类型）
    enabled: boolean
    intervals: number[]     # 复习间隔（天）：[1, 3, 7, 14, 30]
  }
  createdAt: Date
}

// 收藏消息
Favorite {
  id: ObjectId
  userId: ObjectId
  categoryId: ObjectId
  originalMessageId: ObjectId
  originalContent: string   # 原始内容
  processedContent: any     # AI 处理后的内容（JSON）
  
  # 账号密码类型专用字段
  credential?: {
    platform: string        # 平台名称
    url: string             # 网站地址
    username: string        # 用户名
    password: string        # 密码（加密存储）
    notes: string           # 备注
  }
  
  # 知识点类型专用字段
  knowledge?: {
    keyPoints: string[]     # 要点列表
    nextReviewDate: Date    # 下次复习日期
    reviewCount: number     # 已复习次数
    masteryLevel: number    # 掌握程度 0-100
  }
  
  # 待办类型专用字段
  todo?: {
    task: string
    dueDate: Date
    completed: boolean
  }
  
  tags: string[]            # 标签
  createdAt: Date
  updatedAt: Date
}

后端改动：
├── models/FavoriteCategory.ts
├── models/Favorite.ts
├── services/favoriteAIService.ts   # AI 处理逻辑
│   ├── processKnowledge()          # 处理知识点
│   ├── processCredential()         # 处理账号密码
│   ├── processLink()               # 处理链接
│   └── processTodo()               # 处理待办
├── services/reviewScheduler.ts     # 复习调度器
├── controllers/favoriteController.ts
│   ├── addFavorite()               # 添加收藏
│   ├── listFavorites()             # 获取收藏列表
│   ├── searchFavorites()           # 搜索收藏
│   ├── updateFavorite()            # 更新收藏
│   └── deleteFavorite()            # 删除收藏
├── controllers/categoryController.ts
└── routes/favoriteRoutes.ts

前端改动：
├── pages/Favorites.tsx             # 收藏夹页面
├── components/FavoriteCard.tsx     # 收藏卡片
├── components/CategoryList.tsx     # 分类列表
├── components/CredentialList.tsx   # 账号密码列表（整齐展示）
├── components/KnowledgeCard.tsx    # 知识点卡片
├── components/AddFavoriteModal.tsx # 添加收藏弹窗
└── store/favoriteStore.ts
```

**AI 处理示例**：

```
【知识点类型】
原始消息：JavaScript 的闭包是指函数可以访问其词法作用域中的变量，即使函数在其词法作用域之外执行。

AI 处理后：
{
  keyPoints: [
    "闭包 = 函数 + 词法作用域",
    "函数可以访问定义时的变量",
    "即使在外部执行也能访问"
  ],
  nextReviewDate: "2026-02-15",  // 明天复习
  reviewCount: 0,
  masteryLevel: 0
}

复习消息（定时发送）：
"📚 复习时间！
知识点：JavaScript 闭包
要点：
1. 闭包 = 函数 + 词法作用域
2. 函数可以访问定义时的变量
3. 即使在外部执行也能访问

你还记得吗？回复 '记得' 或 '忘了' 来更新掌握程度"

---

【账号密码类型】
原始消息：我的淘宝账号是 zhangsan@qq.com 密码是 Abc123456

AI 处理后：
{
  platform: "淘宝",
  url: "https://www.taobao.com",
  username: "zhangsan@qq.com",
  password: "Abc123456",  // 加密存储
  notes: ""
}

展示格式：
┌─────────────────────────────────┐
│ 🛒 淘宝                          │
│ 网址：www.taobao.com            │
│ 用户名：zhangsan@qq.com         │
│ 密码：••••••••  [复制] [显示]    │
└─────────────────────────────────┘
```

**API 设计**：
| 接口 | 方法 | 描述 |
|------|------|------|
| /api/favorites | GET | 获取收藏列表 |
| /api/favorites | POST | 添加收藏 |
| /api/favorites/:id | PUT | 更新收藏 |
| /api/favorites/:id | DELETE | 删除收藏 |
| /api/favorites/search | GET | 搜索收藏 |
| /api/favorites/categories | GET | 获取分类列表 |
| /api/favorites/categories | POST | 创建分类 |

---

## 十、AI 摘要功能 ⭐ 优先级：中

**需求背景**：
- 长对话难以快速了解要点
- 需要快速回顾对话内容

**功能清单**：
- [ ] 一键总结当前对话
- [ ] 生成对话要点列表
- [ ] 长对话自动摘要提示
- [ ] 摘要保存到收藏

**实现方案**：

```
后端改动：
├── services/summaryService.ts
│   └── generateSummary()     # 调用 AI 生成摘要
├── controllers/messageController.ts
│   └── summarizeChat()       # 总结对话
└── routes/messageRoutes.ts

AI 提示词：
"请总结以下对话的要点，用简洁的列表形式呈现：
{对话内容}"

前端改动：
├── components/SummaryButton.tsx   # 总结按钮
└── components/SummaryModal.tsx    # 摘要展示弹窗
```

**API 设计**：
| 接口 | 方法 | 描述 |
|------|------|------|
| /api/messages/summarize | POST | 生成对话摘要 |

---

## 更新后的开发阶段规划

### 第一阶段：核心功能
1. 手机号登录 + 找回密码
2. 图片消息 + 云存储
3. AI 多机器人系统

### 第二阶段：社交功能
1. 群聊基础功能
2. 私密消息支持
3. QQ 登录

### 第三阶段：高级功能
1. 语音消息
2. AI 游戏助手
3. 预设定时任务
4. **消息搜索**
5. **AI 摘要**

### 第四阶段：智能收藏系统
1. **消息收藏基础功能**
2. **分类管理**
3. **AI 智能处理**
4. **知识点复习系统**
5. **账号密码管理**

### 第五阶段：扩展功能
1. 自定义定时任务
2. 用户自定义机器人
3. 更多桌游支持

---

*最后更新：2026-02-14*
