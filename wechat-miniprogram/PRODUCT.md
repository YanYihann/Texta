# Texta 微信小程序

<!-- impeccable:product-schema 1 -->

## Platform
WeChat Mini Program, native WXML/WXSS/JavaScript.

## Users
Texta 的英语词汇学习用户。输入词汇，生成语境文章，阅读中英对照与词义，收藏文章和复习生词。

## Product Purpose
把已有 Texta 网页的核心学习流程迁移到用户现有的个人主体微信小程序。

## Capabilities and Constraints
用户授权直接修改 C:\Users\19633\Desktop\Liv，保留原 AppID。使用原生小程序页面和已有 Express API；复用邮箱账号、用量和云端资料。原 Liv 图片生成项目保存在 backup/ 中。2026-10-07 用户授权上线后，1.0.0 已上传，用户截图与后续确认表明已发布且新版可见。用户最新选择默认微信直接登录，首次自动建号，邮箱在账号设置中按需绑定以启用网页端。1.1.1 后端已部署，真实微信建号与重复登录通过，小程序已上传并生成预览，仍需手机邮箱设置验收、隐私更新和审核发布，见 WECHAT-FIRST-LOGIN-20261007.md。微信支付仍需另行实现服务端支持，不能伪造。

## Brand Commitments
用户要求改成现有 Texta：继承 D:\wku\雅思\单词 中的 Texta 名称、中文默认界面、绿色阅读工作区及功能语言。直接修改的授权优先于重新进行设计审批。

## Evidence on Hand
Texta public/、DESIGN.md、PRODUCT.md、server.js；Liv 原 AppID 与配置。后端域名来自 Texta public/site-config.js。

## Implementation Decisions
使用原生 JavaScript，保留 AppID；三个原生底部标签页：生成、资料库、我的。文章与词义使用已有 API 格式。缓存按账号隔离，云同步先读取再合并，失败保留本地修改。
