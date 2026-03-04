# Audio Silence Trimmer - Mac Desktop App

这是 Audio Silence Trimmer 的 Mac 桌面应用版本。

## 开发

### 安装依赖
```bash
pnpm install
```

### 开发模式运行
```bash
pnpm electron-dev
```

这会同时启动 Vite 开发服务器和 Electron 应用。

### 构建

#### 构建 Electron 应用
```bash
pnpm electron-build
```

#### 打包成 Mac 应用和 DMG 安装文件
```bash
pnpm electron-pack
```

打包完成后，会在 `release` 目录下生成：
- `Audio Silence Trimmer-x.x.x.dmg` - Mac 安装文件
- `Audio Silence Trimmer-x.x.x.zip` - 压缩包

## 项目结构

```
├── electron/
│   ├── main.ts          # Electron 主进程
│   └── preload.ts       # Preload 脚本
├── client/              # React 应用代码
├── dist/
│   ├── public/          # 打包后的前端代码
│   └── electron/        # 打包后的 Electron 代码
├── assets/              # 应用图标和资源
└── electron-builder.yml # Electron Builder 配置
```

## 功能

- 支持批量上传音频和视频文件
- 检测和分析静音段
- 快速缩短静音（500ms、1000ms）
- 离线使用，无需网络连接
- 原生 Mac 应用体验

## 系统要求

- macOS 10.13 或更高版本
- Intel 或 Apple Silicon Mac

## 注意事项

- 首次运行可能需要在系统偏好设置中允许应用运行
- 应用会在用户的临时目录中缓存音频数据
