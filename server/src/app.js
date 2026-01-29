/**
 * Express 应用主文件
 * 整合所有核心模块和路由
 */

const express = require('express')
const http = require('http')
const socketIO = require('socket.io')
const cors = require('cors')
const path = require('path')
const fs = require('fs')

// 导入核心模块
const DatabaseManager = require('./core/DatabaseManager')
const SourceEngine = require('./core/SourceEngine')
const DownloadManager = require('./core/DownloadManager')

// 导入路由
const musicRouter = require('./routes/music')
const downloadRouter = require('./routes/download')
const sourceRouter = require('./routes/source')
const proxyRouter = require('./routes/proxy')
const userRouter = require('./routes/user')
const playlistRouter = require('./routes/playlist')
const favoriteRouter = require('./routes/favorite')
const tagRouter = require('./routes/tag')

// 环境配置
const PORT = process.env.PORT || 3002
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '../../data')
const MUSIC_DIR = process.env.MUSIC_DIR || path.join(__dirname, '../../music')

class Application {
  constructor() {
    this.app = express()
    this.server = http.createServer(this.app)
    this.io = socketIO(this.server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST']
      }
    })

    // 核心模块实例
    this.database = null
    this.sourceEngine = null
    this.downloadManager = null
  }

  /**
   * 初始化应用
   */
  async init() {
    try {
      console.log('[App] 初始化应用...')

      // 1. 初始化数据库
      this.database = new DatabaseManager(DATA_DIR)
      const db = this.database.getDatabase()

      // 2. 初始化源引擎
      this.sourceEngine = new SourceEngine({
        timeout: 10000,
        enableCache: true
      })

      // 3. 初始化下载管理器
      this.downloadManager = new DownloadManager(db, MUSIC_DIR, this.sourceEngine)

      // 4. 设置中间件
      this.setupMiddleware()

      // 5. 注册路由
      this.setupRoutes()

      // 6. 设置 WebSocket
      this.setupWebSocket()

      // 7. 加载已保存的自定义源
      await this.loadSavedSources()

      // 8. 错误处理
      this.setupErrorHandling()

      console.log('[App] 应用初始化完成')
    } catch (error) {
      console.error('[App] 应用初始化失败:', error)
      throw error
    }
  }

  /**
   * 设置中间件
   */
  setupMiddleware() {
    // CORS
    this.app.use(cors())

    // JSON 解析
    this.app.use(express.json({ limit: '10mb' }))
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }))

    // 静态文件服务
    // 优先尝试 Docker 环境路径 (../public)，如果不存在则尝试本地开发路径 (../../public)
    let publicDir = path.join(__dirname, '../public')
    if (!fs.existsSync(publicDir)) {
      publicDir = path.join(__dirname, '../../public')
    }

    if (fs.existsSync(publicDir)) {
      console.log(`[App] 静态文件目录: ${publicDir}`) // 添加日志方便调试
      this.app.use(express.static(publicDir))
    } else {
      console.warn('[App] ⚠️ 未找到静态文件目录，仅提供 API 服务')
    }

    // 音乐文件服务
    this.app.use('/music', express.static(MUSIC_DIR))

    // 请求日志
    this.app.use((req, res, next) => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`)
      next()
    })

    // 将核心模块挂载到 app 上
    this.app.set('db', this.database.getDatabase())
    this.app.set('sourceEngine', this.sourceEngine)
    this.app.set('downloadManager', this.downloadManager)
  }

  /**
   * 注册路由
   */
  setupRoutes() {
    // 健康检查
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: Date.now(),
        uptime: process.uptime()
      })
    })

    // API 路由
    this.app.use('/api/music', musicRouter)
    this.app.use('/api/download', downloadRouter)
    this.app.use('/api/source', sourceRouter)
    this.app.use('/api/proxy', proxyRouter)
    this.app.use('/api/user', userRouter)
    this.app.use('/api/playlist', playlistRouter)
    this.app.use('/api/favorite', favoriteRouter)
    this.app.use('/api/tag', tagRouter)

    // 根路由
    this.app.get('/', (req, res) => {
      res.json({
        name: 'LX Music Web Server',
        version: '1.0.0',
        status: 'running',
        endpoints: {
          music: '/api/music/*',
          download: '/api/download/*',
          source: '/api/source/*',
          proxy: '/api/proxy/*'
        }
      })
    })

    // 404 处理
    this.app.use((req, res) => {
      res.status(404).json({
        success: false,
        message: 'Route not found'
      })
    })
  }

  /**
   * 设置 WebSocket
   */
  setupWebSocket() {
    this.io.on('connection', (socket) => {
      console.log(`[WebSocket] 客户端连接: ${socket.id}`)

      // 发送欢迎消息
      socket.emit('connected', {
        message: 'Connected to LX Music Web Server',
        socketId: socket.id
      })

      // 监听下载控制事件
      socket.on('download:pause', (taskId) => {
        console.log(`[WebSocket] 暂停下载: ${taskId}`)
        this.downloadManager.pauseTask(taskId)
      })

      socket.on('download:resume', (taskId) => {
        console.log(`[WebSocket] 恢复下载: ${taskId}`)
        this.downloadManager.resumeTask(taskId)
      })

      socket.on('disconnect', () => {
        console.log(`[WebSocket] 客户端断开: ${socket.id}`)
      })
    })

    // 监听下载管理器事件并推送到客户端
    this.downloadManager.on('progress', (data) => {
      this.io.emit('download:progress', data)
    })

    this.downloadManager.on('completed', (data) => {
      this.io.emit('download:completed', data)
    })

    this.downloadManager.on('failed', (data) => {
      this.io.emit('download:failed', data)
    })
  }

  /**
   * 加载已保存的自定义源
   */
  async loadSavedSources() {
    try {
      const db = this.database.getDatabase()
      const sources = db.prepare(`
        SELECT * FROM custom_sources WHERE enabled = 1
      `).all()

      console.log(`[App] 加载 ${sources.length} 个自定义源...`)

      for (const source of sources) {
        try {
          await this.sourceEngine.loadSource(source.id, source.script_content)
          console.log(`[App] 加载源成功: ${source.name}`)
        } catch (error) {
          console.error(`[App] 加载源失败: ${source.name}`, error.message)
        }
      }
    } catch (error) {
      console.error('[App] 加载自定义源失败:', error)
    }
  }

  /**
   * 错误处理
   */
  setupErrorHandling() {
    // 全局错误处理
    this.app.use((error, req, res, next) => {
      console.error('[App] 未捕获的错误:', error)
      
      res.status(500).json({
        success: false,
        message: error.message || 'Internal Server Error'
      })
    })

    // 进程错误处理
    process.on('uncaughtException', (error) => {
      console.error('[App] 未捕获的异常:', error)
    })

    process.on('unhandledRejection', (reason, promise) => {
      console.error('[App] 未处理的 Promise 拒绝:', reason)
    })

    // 优雅关闭
    process.on('SIGTERM', () => this.shutdown())
    process.on('SIGINT', () => this.shutdown())
  }

  /**
   * 启动服务器
   */
  start() {
    this.server.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════════╗
║                                                       ║
║          🎵 LX Music Web Server 已启动                 ║
║                                                       ║
║  服务地址: http://localhost:${PORT}                    ║
║  数据目录: ${DATA_DIR}              ║
║  音乐目录: ${MUSIC_DIR}             ║
║                                                       ║
╚═══════════════════════════════════════════════════════╝
      `)
    })
  }

  /**
   * 关闭服务器
   */
  shutdown() {
    console.log('\n[App] 正在关闭服务器...')

    // 关闭 HTTP 服务器
    this.server.close(() => {
      console.log('[App] HTTP 服务器已关闭')
    })

    // 关闭数据库连接
    if (this.database) {
      this.database.close()
    }

    // 清理其他资源
    if (this.sourceEngine) {
      this.sourceEngine.clearCache()
    }

    console.log('[App] 服务器已关闭')
    process.exit(0)
  }
}

module.exports = Application
