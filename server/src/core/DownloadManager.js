/**
 * 下载管理器
 * 
 * 核心功能:
 * 1. 下载队列管理
 * 2. 并发控制
 * 3. 断点续传
 * 4. 进度实时推送
 * 5. 失败重试
 */

const fs = require('fs')
const path = require('path')
const fetch = require('node-fetch')
const { pipeline } = require('stream/promises')
const EventEmitter = require('events')
const crypto = require('crypto')

class DownloadManager extends EventEmitter {
  constructor(database, musicDir, sourceEngine) {
    super()
    
    this.db = database
    this.musicDir = musicDir
    this.sourceEngine = sourceEngine
    
    // 下载队列
    this.queue = []
    
    // 当前正在下载的任务
    this.activeDownloads = new Map()
    
    // 配置
    this.maxConcurrent = 3 // 最大并发下载数
    this.retryLimit = 3 // 最大重试次数
    this.chunkSize = 1024 * 1024 // 1MB 块大小
    
    // 确保音乐目录存在
    this.ensureMusicDir()
    
    // 从数据库恢复未完成的任务
    this.recoverTasks()
  }

  /**
   * 确保音乐目录存在
   */
  ensureMusicDir() {
    if (!fs.existsSync(this.musicDir)) {
      fs.mkdirSync(this.musicDir, { recursive: true })
      console.log(`[DownloadManager] 创建音乐目录: ${this.musicDir}`)
    }
  }

  /**
   * 从数据库恢复未完成的任务
   */
  recoverTasks() {
    try {
      const unfinishedTasks = this.db.prepare(`
        SELECT * FROM downloads
        WHERE status IN ('pending', 'downloading', 'paused')
        ORDER BY created_at ASC
      `).all()

      for (const task of unfinishedTasks) {
        // 重置为 pending 状态
        this.db.prepare(`
          UPDATE downloads SET status = 'pending' WHERE id = ?
        `).run(task.id)

        // 添加到队列
        this.queue.push({
          taskId: task.id,
          songInfo: JSON.parse(task.song_info),
          quality: task.quality,
          source: task.source,
          filepath: task.filepath,
          retryCount: 0
        })
      }

      if (unfinishedTasks.length > 0) {
        console.log(`[DownloadManager] 恢复 ${unfinishedTasks.length} 个未完成任务`)
        // 自动开始处理
        this.processQueue()
      }
    } catch (error) {
      console.error('[DownloadManager] 恢复任务失败:', error)
    }
  }

  /**
   * 添加下载任务
   */
  async addTask(songInfo, quality, source) {
    const taskId = this.generateTaskId()
    const filename = this.sanitizeFilename(
      `${songInfo.singer} - ${songInfo.name}.mp3`
    )
    const filepath = path.join(this.musicDir, filename)

    // 检查文件是否已存在
    if (fs.existsSync(filepath)) {
      console.log(`[DownloadManager] 文件已存在: ${filename}`)
      return {
        taskId: null,
        status: 'exists',
        filepath,
        message: '文件已存在'
      }
    }

    // 检查是否已在下载队列
    const existingTask = this.queue.find(
      t => t.songInfo.id === songInfo.id && t.quality === quality
    )
    if (existingTask) {
      return {
        taskId: existingTask.taskId,
        status: 'queued',
        message: '已在下载队列中'
      }
    }

    try {
      // 插入数据库
      this.db.prepare(`
        INSERT INTO downloads (
          id, song_id, song_name, artist, album, quality,
          source, song_info, filename, filepath, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        taskId,
        songInfo.id || taskId,
        songInfo.name,
        songInfo.singer,
        songInfo.album || '',
        quality,
        source,
        JSON.stringify(songInfo),
        filename,
        filepath,
        'pending',
        Date.now()
      )

      // 添加到队列
      const task = {
        taskId,
        songInfo,
        quality,
        source,
        filepath,
        retryCount: 0
      }
      
      this.queue.push(task)
      
      console.log(`[DownloadManager] 添加任务: ${taskId} - ${songInfo.name}`)
      
      // 触发队列处理
      this.processQueue()
      
      return {
        taskId,
        status: 'pending',
        filename,
        message: '已添加到下载队列'
      }
    } catch (error) {
      console.error('[DownloadManager] 添加任务失败:', error)
      throw new Error(`添加任务失败: ${error.message}`)
    }
  }

  /**
   * 处理下载队列
   */
  async processQueue() {
    // 如果已达到最大并发数，不处理
    if (this.activeDownloads.size >= this.maxConcurrent) {
      return
    }

    // 如果队列为空，不处理
    if (this.queue.length === 0) {
      return
    }

    // 从队列中取出任务
    const task = this.queue.shift()
    this.activeDownloads.set(task.taskId, task)

    // 异步执行下载
    this.downloadTask(task)
      .then(() => {
        console.log(`[DownloadManager] 任务完成: ${task.taskId}`)
      })
      .catch(error => {
        console.error(`[DownloadManager] 任务失败: ${task.taskId}`, error)
        this.handleDownloadError(task, error)
      })
      .finally(() => {
        // 从活动下载中移除
        this.activeDownloads.delete(task.taskId)
        
        // 继续处理队列
        this.processQueue()
      })

    // 如果还有空闲槽位，继续处理
    if (this.activeDownloads.size < this.maxConcurrent && this.queue.length > 0) {
      this.processQueue()
    }
  }

  /**
   * 执行下载任务
   */
  async downloadTask(task) {
    const { taskId, songInfo, quality, source, filepath } = task

    try {
      // 1. 更新状态为下载中
      this.updateTaskStatus(taskId, 'downloading')

      // 2. 获取播放链接
      console.log(`[DownloadManager] 获取播放链接: ${songInfo.name}`)
      const urlResult = await this.sourceEngine.getMusicUrl(source, songInfo, quality)
      
      let url
      if (typeof urlResult === 'string') {
        url = urlResult
      } else if (urlResult && urlResult.url) {
        url = urlResult.url
      } else {
        throw new Error('无法获取播放链接')
      }

      if (!url) {
        throw new Error('播放链接为空')
      }

      console.log(`[DownloadManager] 开始下载: ${url.substring(0, 100)}...`)

      // 3. 检查是否支持断点续传
      const existingSize = fs.existsSync(filepath) ? fs.statSync(filepath).size : 0
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': this.getRefererForSource(source)
      }

      if (existingSize > 0) {
        headers['Range'] = `bytes=${existingSize}-`
      }

      // 4. 发送请求
      const response = await fetch(url, { headers, timeout: 30000 })

      if (!response.ok && response.status !== 206) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      // 5. 获取文件总大小
      const contentLength = response.headers.get('content-length')
      const totalSize = contentLength ? parseInt(contentLength) + existingSize : null
      
      console.log(`[DownloadManager] 文件大小: ${totalSize ? (totalSize / 1024 / 1024).toFixed(2) + ' MB' : '未知'}`)

      // 6. 流式下载
      let downloadedSize = existingSize
      const fileStream = fs.createWriteStream(filepath, {
        flags: existingSize > 0 ? 'a' : 'w' // 追加或新建
      })

      // 监听数据
      response.body.on('data', (chunk) => {
        downloadedSize += chunk.length

        if (totalSize) {
          const progress = ((downloadedSize / totalSize) * 100).toFixed(2)
          
          // 更新进度到数据库 (每 1% 更新一次)
          if (Math.floor(progress) !== Math.floor((downloadedSize - chunk.length) / totalSize * 100)) {
            this.updateTaskProgress(taskId, progress, downloadedSize, totalSize)
          }

          // 触发进度事件
          this.emit('progress', {
            taskId,
            songName: songInfo.name,
            progress: parseFloat(progress),
            downloadedSize,
            totalSize,
            speed: this.calculateSpeed(taskId, chunk.length)
          })
        }
      })

      // 开始流式传输
      await pipeline(response.body, fileStream)

      // 7. 下载完成
      const fileSize = fs.statSync(filepath).size
      this.updateTaskStatus(taskId, 'completed', filepath, fileSize)
      
      this.emit('completed', {
        taskId,
        songName: songInfo.name,
        filepath,
        fileSize
      })

      console.log(`[DownloadManager] 下载完成: ${songInfo.name}`)
    } catch (error) {
      throw error
    }
  }

  /**
   * 处理下载错误
   */
  async handleDownloadError(task, error) {
    const { taskId, songInfo, retryCount } = task

    console.error(`[DownloadManager] 下载失败: ${songInfo.name}`, error.message)

    // 判断是否重试
    if (retryCount < this.retryLimit) {
      task.retryCount++
      
      console.log(`[DownloadManager] 重试任务 (${task.retryCount}/${this.retryLimit}): ${taskId}`)
      
      // 重新加入队列
      this.queue.push(task)
      
      // 更新状态
      this.updateTaskStatus(taskId, 'retrying')
      
      // 延迟后继续处理
      setTimeout(() => this.processQueue(), 3000)
    } else {
      // 超过重试次数，标记为失败
      this.updateTaskStatus(taskId, 'failed', null, null, error.message)
      
      this.emit('failed', {
        taskId,
        songName: songInfo.name,
        error: error.message
      })
    }
  }

  /**
   * 更新任务进度
   */
  updateTaskProgress(taskId, progress, downloadedSize, totalSize) {
    try {
      this.db.prepare(`
        UPDATE downloads
        SET progress = ?, downloaded_size = ?, total_size = ?, updated_at = ?
        WHERE id = ?
      `).run(progress, downloadedSize, totalSize, Date.now(), taskId)
    } catch (error) {
      console.error('[DownloadManager] 更新进度失败:', error)
    }
  }

  /**
   * 更新任务状态
   */
  updateTaskStatus(taskId, status, filepath = null, fileSize = null, errorMessage = null) {
    try {
      const updates = {
        status,
        updated_at: Date.now()
      }

      if (filepath) updates.filepath = filepath
      if (fileSize) updates.file_size = fileSize
      if (errorMessage) updates.error_message = errorMessage
      if (status === 'completed') updates.completed_at = Date.now()

      const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ')
      const values = [...Object.values(updates), taskId]

      this.db.prepare(`UPDATE downloads SET ${fields} WHERE id = ?`).run(...values)
    } catch (error) {
      console.error('[DownloadManager] 更新状态失败:', error)
    }
  }

  /**
   * 暂停任务
   */
  pauseTask(taskId) {
    // 从队列中移除
    const index = this.queue.findIndex(t => t.taskId === taskId)
    if (index !== -1) {
      this.queue.splice(index, 1)
      this.updateTaskStatus(taskId, 'paused')
      console.log(`[DownloadManager] 任务已暂停: ${taskId}`)
      return true
    }
    
    // TODO: 如果任务正在下载，需要中断下载
    return false
  }

  /**
   * 恢复任务
   */
  resumeTask(taskId) {
    try {
      const task = this.db.prepare('SELECT * FROM downloads WHERE id = ?').get(taskId)
      
      if (!task) {
        throw new Error('任务不存在')
      }

      if (task.status !== 'paused' && task.status !== 'failed') {
        throw new Error('任务状态不允许恢复')
      }

      // 重新加入队列
      this.queue.push({
        taskId: task.id,
        songInfo: JSON.parse(task.song_info),
        quality: task.quality,
        source: task.source,
        filepath: task.filepath,
        retryCount: 0
      })

      this.updateTaskStatus(taskId, 'pending')
      this.processQueue()

      console.log(`[DownloadManager] 任务已恢复: ${taskId}`)
      return true
    } catch (error) {
      console.error('[DownloadManager] 恢复任务失败:', error)
      return false
    }
  }

  /**
   * 删除任务
   */
  deleteTask(taskId) {
    try {
      // 从队列移除
      const index = this.queue.findIndex(t => t.taskId === taskId)
      if (index !== -1) {
        this.queue.splice(index, 1)
      }

      // 从数据库删除
      this.db.prepare('DELETE FROM downloads WHERE id = ?').run(taskId)

      console.log(`[DownloadManager] 任务已删除: ${taskId}`)
      return true
    } catch (error) {
      console.error('[DownloadManager] 删除任务失败:', error)
      return false
    }
  }

  /**
   * 获取任务列表
   */
  getTasks(status = null, limit = 100) {
    try {
      let query = 'SELECT * FROM downloads'
      const params = []

      if (status) {
        query += ' WHERE status = ?'
        params.push(status)
      }

      query += ' ORDER BY created_at DESC LIMIT ?'
      params.push(limit)

      return this.db.prepare(query).all(...params)
    } catch (error) {
      console.error('[DownloadManager] 获取任务列表失败:', error)
      return []
    }
  }

  /**
   * 获取任务详情
   */
  getTask(taskId) {
    try {
      return this.db.prepare('SELECT * FROM downloads WHERE id = ?').get(taskId)
    } catch (error) {
      console.error('[DownloadManager] 获取任务详情失败:', error)
      return null
    }
  }

  /**
   * 根据音源获取 Referer
   */
  getRefererForSource(source) {
    const referers = {
      kw: 'https://www.kuwo.cn/',
      kg: 'https://www.kugou.com/',
      tx: 'https://y.qq.com/',
      wy: 'https://music.163.com/',
      mg: 'https://music.migu.cn/'
    }
    return referers[source] || 'https://music.example.com/'
  }

  /**
   * 计算下载速度
   */
  calculateSpeed(taskId, chunkSize) {
    // TODO: 实现速度计算
    return 0
  }

  /**
   * 生成任务ID
   */
  generateTaskId() {
    return `dl_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  }

  /**
   * 清理文件名
   */
  sanitizeFilename(filename) {
    return filename
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, '') // 移除非法字符
      .replace(/\s+/g, ' ') // 合并空格
      .trim()
      .substring(0, 200) // 限制长度
  }

  /**
   * 获取统计信息
   */
  getStats() {
    try {
      const stats = this.db.prepare(`
        SELECT 
          status,
          COUNT(*) as count,
          SUM(file_size) as total_size
        FROM downloads
        GROUP BY status
      `).all()

      return {
        queue: this.queue.length,
        active: this.activeDownloads.size,
        stats
      }
    } catch (error) {
      console.error('[DownloadManager] 获取统计失败:', error)
      return null
    }
  }
}

module.exports = DownloadManager
