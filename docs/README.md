# Texta 文档

项目概览和首次运行见 [主 README](../README.md)。本索引按用途组织当前实现说明；文档中的测试或支付状态记录以文内日期为准。

## 开发与发布

| 文档 | 内容 |
| --- | --- |
| [开发与验证](development.md) | 测试入口、夹具、数据库检查及实验边界 |
| [部署说明](deployment.md) | Pages、Render、数据库、密钥和发布流程 |
| [Next.js 前端](next-frontend.md) | 新前端运行、静态部署、旧数据兼容与迁移验收 |
| [Windows 桌面版](desktop.md) | 客户端运行、安装包、签名和分发 |
| [产品要求](../PRODUCT.md) | 学习流程、能力和产品边界 |
| [界面规范](../DESIGN.md) | 排版、颜色、动效和交互 |

## 文章与词汇

| 文档 | 内容 |
| --- | --- |
| [双语生成](bilingual-generation.md) | 成对英中输出、词义标记与对齐校验 |
| [中英混合生成](mixed-direct-generation.md) | 直接生成故事、校验与重试边界 |
| [完整词汇卡](vocabulary-details.md) | 并行准备、持久缓存和旧材料兼容 |
| [当前提示词](../CURRENT_PROMPTS.md) | 提示词说明；完整实现以 generation/ 源码为准 |
| [生成实验](../experiments/README.md) | 历史数据集、实验报告和输出记录 |

## 账号、支付与政策

| 文档 | 内容 |
| --- | --- |
| [微信登录与账号关联](wechat-login.md) | 配置、数据合并、权限和验证 |
| [网页微信连接状态](web-wechat-status.md) | 绑定状态显示与刷新 |
| [支付启用](../FASTSPRING_SETUP.md) | FastSpring 配置、测试记录和启用条件 |
| [支付商店审核](fastspring-store-review.md) | 提交与验收记录 |
| [政策页面](texta-policy-ui.md) | 隐私、条款与退款页面 |

## 历史资料

- [旧版单词生成流程](archive/word-to-article-process.md)：重构前的流程与提示词快照，不能用于判断当前实现。
- [作品集整理素材](archive/portfolio-source.md)：历史功能整理，部分设置已被后续实现替换。

备份、日志和原始模型运行轨迹不进入当前发布内容。移除当前分支对数据库备份的跟踪不会清除旧 Git 提交中的文件；本次整理保留原提交历史。
