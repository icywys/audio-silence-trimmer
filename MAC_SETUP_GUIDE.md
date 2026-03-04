# Mac 桌面应用安装指南

## 完整操作步骤

### 第一步：在 Mac 上准备环境

1. **安装 Node.js 和 pnpm**
   - 如果还没安装，先安装 Node.js：访问 https://nodejs.org/ 下载 LTS 版本
   - 安装完后，打开终端（Terminal）运行以下命令安装 pnpm：
   ```bash
   npm install -g pnpm
   ```

2. **验证安装**
   ```bash
   node --version
   pnpm --version
   ```

### 第二步：获取项目代码

1. **下载项目文件**
   - 从 Manus 管理界面的"Code"面板下载所有文件
   - 或者如果有 GitHub 链接，直接 clone

2. **打开终端，进入项目目录**
   ```bash
   cd /path/to/audio-silence-trimmer
   ```
   
   比如如果你下载到了 Downloads 文件夹：
   ```bash
   cd ~/Downloads/audio-silence-trimmer
   ```

### 第三步：安装依赖

在项目目录中运行：
```bash
pnpm install
```

这会安装所有需要的依赖，包括 Electron。可能需要 5-10 分钟。

### 第四步：打包成 Mac 应用

运行以下命令生成 `.dmg` 安装文件：
```bash
pnpm electron-pack
```

这个过程会：
1. 构建前端代码
2. 编译 Electron 主进程
3. 生成 Mac 应用
4. 创建 DMG 安装文件

完成后，你会看到类似的输出：
```
✓ built in 5.73s
✓ building native dependencies for macOS
✓ signing app
✓ creating DMG
✓ done
```

### 第五步：找到安装文件

打包完成后，安装文件会在 `release` 文件夹中：

```bash
ls -la release/
```

你会看到：
- `Audio Silence Trimmer-1.0.0.dmg` - 这就是安装文件！
- `Audio Silence Trimmer-1.0.0.zip` - 压缩版本

### 第六步：安装应用

1. **双击 `.dmg` 文件**
   - 打开 Finder，找到 `Audio Silence Trimmer-1.0.0.dmg`
   - 双击打开
   
2. **拖拽安装**
   - 会弹出一个窗口，显示应用图标和 Applications 文件夹
   - 把应用图标拖到 Applications 文件夹中
   
3. **运行应用**
   - 打开 Applications 文件夹
   - 找到 "Audio Silence Trimmer"
   - 双击运行

### 第七步：首次运行

- 第一次运行时，macOS 可能会提示"无法验证开发者"
- 点击"打开"即可运行
- 或者在系统偏好设置 > 安全性与隐私 中允许

## 常见问题

### Q: 运行 `pnpm install` 时出错？
A: 确保你已经安装了 Node.js 和 pnpm，并且在正确的项目目录中。

### Q: 打包时出现"找不到图标"错误？
A: 检查 `assets/icon.png` 文件是否存在。

### Q: 应用无法启动？
A: 尝试在终端中运行应用来查看错误信息：
```bash
open -a "Audio Silence Trimmer"
```

### Q: 想要修改应用名称或版本？
A: 编辑 `package.json` 中的 `version` 字段，然后重新运行 `pnpm electron-pack`

## 开发模式运行

如果你想在开发模式下测试（支持热更新）：
```bash
pnpm electron-dev
```

这会同时启动 Vite 开发服务器和 Electron 应用。

## 项目结构说明

```
audio-silence-trimmer/
├── electron/                 # Electron 主进程代码
│   ├── main.ts              # 应用主文件
│   └── preload.ts           # 安全脚本
├── client/                   # React 前端代码
├── assets/                   # 应用图标
├── package.json             # 项目配置
├── electron-builder.yml     # 打包配置
└── release/                 # 打包输出目录（运行后生成）
```

## 下一步

打包完成后，你可以：
1. 分享 `.dmg` 文件给其他人使用
2. 继续开发新功能
3. 修改应用图标和名称
