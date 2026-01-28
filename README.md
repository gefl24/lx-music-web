# 🎵 LX Music Web

基于 lx-music-desktop 核心逻辑的 Web 版本,支持 Docker 一键部署。

## ✨ 特性

- 🎵 **多音源支持**: 完全兼容 lx-music-desktop 的自定义源
- 🌐 **Web 访问**: 无需安装客户端,浏览器即可使用
- 📥 **服务器端下载**: 支持断点续传、队列管理
- 🔄 **实时推送**: WebSocket 实时推送下载进度
- 🛡️ **防盗链代理**: 自动处理音乐平台的防盗链
- 💾 **数据持久化**: SQLite 数据库存储
- 🐳 **容器化部署**: Docker 一键部署
- 🎨 **现代化 UI**: Vue 3 + Element Plus

## 📸 预览

```
┌─────────────────────────────────────────────────────────┐
│  🎵 LX Music                                            │
│  ├─ 🔍 搜索音乐                                          │
│  └─ 📥 下载管理                                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  [搜索框: 请输入歌曲名、歌手、专辑]          [搜索]      │
│                                                         │
│  搜索结果:                                              │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 歌名          歌手        专辑        [播放][下载] │   │
│  │ 周杰伦-晴天    周杰伦      叶惠美      [▶] [⬇]    │   │
│  │ 周杰伦-七里香  周杰伦      七里香      [▶] [⬇]    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
│ ♫ 正在播放: 晴天 - 周杰伦      [◀] [▶] [▶▶]    🔊 80%  │
└─────────────────────────────────────────────────────────┘
```

## 🚀 快速开始

### 方式一: Docker 部署 (推荐)

```bash
# 1. 克隆项目
git clone https://github.com/your-repo/lx-music-web.git
cd lx-music-web

# 2. 构建并启动
docker-compose up -d

# 3. 访问
# 打开浏览器访问 http://localhost:3000
```

### 方式二: 本地开发

#### 后端

```bash
cd server

# 安装依赖
npm install

# 启动服务
npm start

# 或开发模式
npm run dev
```

#### 前端

```bash
cd client

# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
```

## 📖 使用指南

### 1. 上传自定义源

访问 `http://localhost:3000` 后,进入"音源管理"页面:

1. 点击"上传音源"
2. 选择自定义源 JavaScript 文件
3. 上传成功后即可使用

**测试源文件**: `server/tests/test-source.js`

### 2. 搜索音乐

1. 在搜索框中输入歌曲名、歌手或专辑
2. 选择音源
3. 点击搜索按钮
4. 点击"播放"按钮在线播放
5. 点击"下载"按钮添加到下载队列

### 3. 管理下载

进入"下载管理"页面:

- 查看所有下载任务
- 实时查看下载进度
- 暂停/恢复/删除任务
- 筛选不同状态的任务

## 🔧 配置

### 环境变量

创建 `.env` 文件 (或修改 `docker-compose.yml`):

```env
# 服务器端口
PORT=3000

# 数据目录
DATA_DIR=/app/data

# 音乐存储目录
MUSIC_DIR=/app/music

# Node 环境
NODE_ENV=production

# 可选: HTTP 代理
# HTTP_PROXY=http://proxy.example.com:8080
# HTTPS_PROXY=http://proxy.example.com:8080
```

## 📁 目录结构

```
lx-music-web/
├── server/                    # 后端
│   ├── src/
│   │   ├── core/             # 核心模块
│   │   │   ├── SourceEngine.js
│   │   │   ├── DownloadManager.js
│   │   │   └── DatabaseManager.js
│   │   ├── routes/           # API 路由
│   │   └── app.js           # Express 应用
│   ├── tests/               # 测试
│   ├── index.js             # 入口
│   └── package.json
├── client/                   # 前端
│   ├── src/
│   │   ├── views/           # 页面
│   │   ├── components/      # 组件
│   │   ├── stores/          # 状态管理
│   │   ├── api/             # API 封装
│   │   ├── router/          # 路由
│   │   ├── App.vue
│   │   └── main.js
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
├── Dockerfile               # Docker 构建文件
├── docker-compose.yml       # Docker Compose 配置
└── README.md
```

## 🔌 API 文档

详细 API 文档请参考 [API.md](docs/API.md)

### 主要端点

```
POST   /api/music/search          搜索音乐
POST   /api/music/url              获取播放链接
POST   /api/music/lyric            获取歌词
POST   /api/download/add           添加下载任务
GET    /api/download/list          获取下载列表
GET    /api/source/list            获取音源列表
POST   /api/source/upload          上传音源
GET    /api/proxy/stream           代理音频流
```

## 🧪 测试

```bash
# 进入服务器目录
cd server

# 运行测试脚本
node test-api.js
```

## 🛠️ 开发自定义源

### 基本结构

```javascript
/**
 * @name 音源名称
 * @version 1.0.0
 * @author 作者
 * @description 描述
 */

// 搜索方法 (必需)
globalThis.search = async ({ keyword, page, limit }) => {
  return [
    {
      id: '歌曲ID',
      name: '歌曲名',
      singer: '歌手',
      album: '专辑',
      duration: 240
    }
  ]
}

// 获取播放链接 (必需)
globalThis.getUrl = async ({ songInfo, quality }) => {
  return 'https://example.com/song.mp3'
}

// 获取歌词 (可选)
globalThis.getLyric = async ({ songInfo }) => {
  return '[00:00.00]歌词内容'
}
```

### 可用 API

- `lx.request(url, options, callback)` - HTTP 请求
- `lx.utils.crypto.md5(data)` - MD5 加密
- `lx.utils.crypto.aesEncrypt()` - AES 加密
- `lx.utils.buffer.from()` - Buffer 操作
- `lx.utils.zlib.gzip()` - Gzip 压缩

## 🐛 故障排除

### 问题: 容器启动失败

**解决方案**:
```bash
# 查看日志
docker-compose logs -f

# 重新构建
docker-compose build --no-cache
docker-compose up -d
```

### 问题: 音频无法播放

**解决方案**: 
音频链接会自动通过代理播放,如果仍无法播放:
1. 检查音源是否返回有效链接
2. 查看浏览器控制台错误
3. 确认服务器网络正常

### 问题: 下载失败

**解决方案**:
1. 检查音乐目录权限
2. 查看服务器日志
3. 确认磁盘空间充足

## 📝 开发计划

- [x] 后端核心模块
- [x] 前端 Vue 3 界面
- [x] Docker 部署
- [ ] 用户认证系统
- [ ] 播放列表管理
- [ ] 移动端适配
- [ ] 多用户支持

## 🤝 贡献

欢迎提交 Issue 和 Pull Request!

## 📄 许可证

Apache License 2.0

## 🙏 致谢

本项目基于 [lx-music-desktop](https://github.com/lyswhut/lx-music-desktop) 的核心逻辑开发。

## ⚠️ 免责声明

本项目仅供学习交流使用,不提供任何内置音乐源。用户需自行承担使用自定义源的法律责任。禁止用于商业用途。

---

**项目状态**: ✅ 核心功能完成 | 🚀 可用于生产

**最后更新**: 2026-01-28
