# LX Music Web Server

基于 lx-music-desktop 核心逻辑的 Web 服务器版本。

## ✨ 特性

- 🎵 **多音源支持**: 完全兼容 lx-music-desktop 的自定义源
- 📥 **服务器端下载**: 支持断点续传、队列管理
- 🔄 **实时推送**: WebSocket 实时推送下载进度
- 🛡️ **防盗链代理**: 自动处理音乐平台的防盗链
- 💾 **数据持久化**: SQLite 数据库存储
- 🐳 **容器化部署**: Docker 一键部署

## 📦 安装

### 方式一: 本地安装

```bash
# 安装依赖
npm install

# 启动服务
npm start

# 开发模式 (热重载)
npm run dev
```

### 方式二: Docker 部署

```bash
# 构建镜像
docker build -t lx-music-web .

# 运行容器
docker run -d \
  -p 3000:3000 \
  -v ./data:/app/data \
  -v ./music:/app/music \
  --name lx-music-web \
  lx-music-web
```

## 🚀 快速开始

### 1. 启动服务器

```bash
npm start
```

服务器将在 `http://localhost:3000` 启动。

### 2. 上传自定义源

```bash
curl -X POST http://localhost:3000/api/source/upload \
  -F "source=@your-source.js"
```

### 3. 搜索音乐

```bash
curl -X POST http://localhost:3000/api/music/search \
  -H "Content-Type: application/json" \
  -d '{
    "keyword": "周杰伦",
    "source": "test",
    "page": 1
  }'
```

### 4. 添加下载任务

```bash
curl -X POST http://localhost:3000/api/download/add \
  -H "Content-Type: application/json" \
  -d '{
    "songInfo": {
      "id": "123",
      "name": "歌曲名",
      "singer": "歌手"
    },
    "quality": "128k",
    "source": "test"
  }'
```

## 📖 API 文档

### 音乐相关

#### 搜索音乐
```
POST /api/music/search
Content-Type: application/json

{
  "keyword": "关键词",
  "source": "音源ID",
  "page": 1,
  "limit": 30
}
```

#### 获取播放链接
```
POST /api/music/url
Content-Type: application/json

{
  "songInfo": { "id": "123", "name": "歌名" },
  "quality": "128k",
  "source": "音源ID"
}
```

#### 获取歌词
```
POST /api/music/lyric
Content-Type: application/json

{
  "songInfo": { "id": "123", "name": "歌名" },
  "source": "音源ID"
}
```

### 下载管理

#### 添加下载任务
```
POST /api/download/add
Content-Type: application/json

{
  "songInfo": { "id": "123", "name": "歌名", "singer": "歌手" },
  "quality": "128k",
  "source": "音源ID"
}
```

#### 获取下载列表
```
GET /api/download/list?status=all&limit=100
```

#### 暂停下载
```
POST /api/download/pause
Content-Type: application/json

{
  "taskId": "dl_xxx"
}
```

#### 恢复下载
```
POST /api/download/resume
Content-Type: application/json

{
  "taskId": "dl_xxx"
}
```

### 音源管理

#### 获取音源列表
```
GET /api/source/list
```

#### 上传自定义源
```
POST /api/source/upload
Content-Type: multipart/form-data

source: [JavaScript 文件]
```

#### 删除音源
```
DELETE /api/source/:id
```

#### 启用/禁用音源
```
POST /api/source/toggle
Content-Type: application/json

{
  "sourceId": "source_id",
  "enabled": true
}
```

### 音频代理

#### 代理音频流
```
GET /api/proxy/stream?url=[音频URL]&source=[音源ID]
```

## 🔧 配置

### 环境变量

```bash
# 服务端口
PORT=3000

# 数据目录
DATA_DIR=/app/data

# 音乐存储目录
MUSIC_DIR=/app/music

# Node 环境
NODE_ENV=production
```

### 目录结构

```
lx-music-web/
├── server/
│   ├── src/
│   │   ├── core/              # 核心模块
│   │   │   ├── SourceEngine.js
│   │   │   ├── DownloadManager.js
│   │   │   └── DatabaseManager.js
│   │   ├── routes/            # 路由
│   │   │   ├── music.js
│   │   │   ├── download.js
│   │   │   ├── source.js
│   │   │   └── proxy.js
│   │   └── app.js            # 应用主文件
│   ├── tests/                # 测试
│   ├── index.js              # 入口文件
│   └── package.json
├── data/                     # 数据目录 (挂载)
│   └── lx-music.db          # SQLite 数据库
└── music/                    # 音乐目录 (挂载)
```

## 🧪 测试

### 运行单元测试

```bash
npm test
```

### 测试自定义源

服务器包含一个测试源 (`tests/test-source.js`),可以用于验证功能:

```bash
curl -X POST http://localhost:3000/api/source/upload \
  -F "source=@tests/test-source.js"
```

## 🐛 故障排除

### 问题: 无法加载自定义源

**解决方案**: 检查源脚本是否实现了必需的方法 (`search`, `getUrl`)

### 问题: 音频无法播放

**解决方案**: 使用代理接口播放: `/api/proxy/stream?url=...`

### 问题: 下载失败

**解决方案**: 
1. 检查音乐目录权限
2. 查看日志输出
3. 确认播放链接有效性

## 📝 开发自定义源

### 基本结构

```javascript
/**
 * @name 音源名称
 * @version 1.0.0
 * @author 作者
 * @description 描述
 */

// 搜索方法 (必需)
globalThis.search = async (params) => {
  const { keyword, page, limit } = params
  // 实现搜索逻辑
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
globalThis.getUrl = async (params) => {
  const { songInfo, quality } = params
  // 实现获取播放链接逻辑
  return 'https://example.com/song.mp3'
}

// 获取歌词 (可选)
globalThis.getLyric = async (params) => {
  const { songInfo } = params
  // 返回 LRC 格式歌词
  return '[00:00.00]歌词内容'
}
```

### 可用 API

自定义源中可以使用以下 API:

- `lx.request(url, options, callback)` - HTTP 请求
- `lx.utils.crypto.md5(data)` - MD5 加密
- `lx.utils.crypto.aesEncrypt(data, mode, key, iv)` - AES 加密
- `lx.utils.buffer.from(data, encoding)` - 创建 Buffer
- `lx.utils.zlib.gzip(data)` - Gzip 压缩

详细文档请参考 `docs/custom-source-api.md`

## 🤝 贡献

欢迎提交 Issue 和 Pull Request!

## 📄 许可证

Apache License 2.0

## 🙏 致谢

本项目基于 [lx-music-desktop](https://github.com/lyswhut/lx-music-desktop) 的核心逻辑开发。
