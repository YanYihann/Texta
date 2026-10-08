# Texta Windows 桌面版

桌面版是连接 `https://texta.yanyihan.top/` 的 Electron 客户端。支持 Windows 10/11 x64，安装后可从桌面或开始菜单打开，不需要用户安装 Node.js、配置数据库或 API Key。

## 使用与边界

- 与网页版共用账号、套餐和已同步到服务器的学习数据。首次打开需重新登录。
- 浏览器的登录状态、未同步草稿和本地历史不会自动迁移；客户端在自己的用户数据目录保存登录状态。
- 登录、生成和云端数据需要联网；网站加载失败时显示重试页面。
- PDF / Word 导出使用系统保存对话框。支付和站外链接在默认浏览器中打开。
- 网页内容随线上站点更新；Electron 运行时更新需要下载新版安装包，目前没有自动更新器。
- 当前安装包未配置代码签名证书，Windows 可能显示未知发布者提示。公开正式分发前应配置发布者证书。

## 本地运行与构建

在仓库根目录运行（建议 Node.js 22 或更新版本）：

```powershell
npm run desktop:install
npm run desktop:start
npm run test:desktop
npm run desktop:build
```

安装包输出：`output/desktop/Texta-Setup-1.0.0-x64.exe`。安装向导允许选择目录，默认按当前用户安装，创建桌面及开始菜单快捷方式。卸载默认保留客户端用户数据。

构建只包含 `desktop/` 中明确列出的客户端文件，不包含 `.env`、数据库、服务端代码或模型密钥。

## 下载与发布

可以直接发送生成的 EXE，或上传到 GitHub Releases / 自有下载服务。仓库提供手动运行的 `Build Windows Desktop` 工作流，下载工作流产物即可获取安装包和 SHA-256 校验文件；它不会自动发布 Release。

公开发布流程：修改 `desktop/package.json` 版本并更新 lockfile，构建和检查安装包，再创建 GitHub Release 上传 EXE。待真实下载地址可用后，在网站添加下载入口，避免出现无效下载链接。

可在构建环境配置 electron-builder 的 `CSC_LINK` 和 `CSC_KEY_PASSWORD` 完成签名，不要将证书或密码提交到仓库。

## 验证

```powershell
npm test --prefix desktop
npm run icons --prefix desktop
npm run test:smoke --prefix desktop
```

安全策略测试检查站内导航边界和外部协议限制；Electron 冒烟测试验证实际渲染、安全设置、弹窗支付跳转、下载和断网恢复。支付真实扣款、已有账号同步和另一台电脑安装需要在发布验收中验证。

参考：[Electron 安全指南](https://www.electronjs.org/docs/latest/tutorial/security)、[NSIS 打包配置](https://www.electron.build/v26/docs/nsis/)。
