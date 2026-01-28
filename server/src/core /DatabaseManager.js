/**
 * 数据库管理器
 * 使用 SQLite 存储数据
 */

const Database = require('better-sqlite3')
const path = require('path')
const fs = require('fs')

class DatabaseManager {
  constructor(dataDir) {
    this.dataDir = dataDir
    this.dbPath = path.join(dataDir, 'lx-music.db')
    
    // 确保数据目录存在
    this.ensureDataDir()
    
    // 初始化数据库
    this.db = new Database(this.dbPath, {
      verbose: process.env.NODE_ENV === 'development' ? console.log : null
    })
    
    // 开启 WAL 模式 (提高并发性能)
    this.db.pragma('journal_mode = WAL')
    
    // 初始化表结构
    this.initTables()
    
    console.log(`[Database] 数据库已连接: ${this.dbPath}`)
  }

  /**
   * 确保数据目录存在
   */
  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true })
      console.log(`[Database] 创建数据目录: ${this.dataDir}`)
    }
  }

  /**
   * 初始化数据库表
   */
  initTables() {
    // 下载任务表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS downloads (
        id TEXT PRIMARY KEY,
        song_id TEXT NOT NULL,
        song_name TEXT NOT NULL,
        artist TEXT,
        album TEXT,
        quality TEXT NOT NULL,
        source TEXT NOT NULL,
        song_info TEXT NOT NULL,
        filename TEXT NOT NULL,
        filepath TEXT,
        status TEXT NOT NULL,
        progress REAL DEFAULT 0,
        downloaded_size INTEGER DEFAULT 0,
        total_size INTEGER,
        file_size INTEGER,
        error_message TEXT,
        retry_count INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER,
        completed_at INTEGER
      )
    `)

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_downloads_status ON downloads(status)
    `)

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_downloads_created_at ON downloads(created_at DESC)
    `)

    // 播放列表表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS playlists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        cover_url TEXT,
        song_count INTEGER DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER
      )
    `)

    // 播放列表歌曲关联表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS playlist_songs (
        id TEXT PRIMARY KEY,
        playlist_id TEXT NOT NULL,
        song_id TEXT NOT NULL,
        song_info TEXT NOT NULL,
        sort_order INTEGER,
        added_at INTEGER NOT NULL,
        FOREIGN KEY (playlist_id) REFERENCES playlists(id) ON DELETE CASCADE
      )
    `)

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist ON playlist_songs(playlist_id)
    `)

    // 播放历史表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS play_history (
        id TEXT PRIMARY KEY,
        song_id TEXT NOT NULL,
        song_info TEXT NOT NULL,
        source TEXT NOT NULL,
        played_at INTEGER NOT NULL
      )
    `)

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_play_history_played_at ON play_history(played_at DESC)
    `)

    // 自定义源表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS custom_sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        version TEXT,
        author TEXT,
        homepage TEXT,
        script_content TEXT NOT NULL,
        enabled INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER
      )
    `)

    // 应用配置表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at INTEGER
      )
    `)

    console.log('[Database] 数据库表初始化完成')
  }

  /**
   * 获取数据库实例
   */
  getDatabase() {
    return this.db
  }

  /**
   * 执行事务
   */
  transaction(fn) {
    return this.db.transaction(fn)
  }

  /**
   * 关闭数据库连接
   */
  close() {
    if (this.db) {
      this.db.close()
      console.log('[Database] 数据库连接已关闭')
    }
  }

  /**
   * 备份数据库
   */
  async backup(backupPath) {
    try {
      await this.db.backup(backupPath)
      console.log(`[Database] 数据库已备份到: ${backupPath}`)
      return true
    } catch (error) {
      console.error('[Database] 备份失败:', error)
      return false
    }
  }

  /**
   * 清理历史数据
   */
  cleanup(daysToKeep = 30) {
    const cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000)
    
    try {
      // 清理播放历史
      const historyResult = this.db.prepare(`
        DELETE FROM play_history WHERE played_at < ?
      `).run(cutoffTime)

      // 清理已完成的下载记录
      const downloadResult = this.db.prepare(`
        DELETE FROM downloads 
        WHERE status = 'completed' AND completed_at < ?
      `).run(cutoffTime)

      console.log(`[Database] 清理完成: ${historyResult.changes} 条历史, ${downloadResult.changes} 条下载记录`)
      
      return {
        history: historyResult.changes,
        downloads: downloadResult.changes
      }
    } catch (error) {
      console.error('[Database] 清理失败:', error)
      return null
    }
  }

  /**
   * 获取数据库统计信息
   */
  getStats() {
    try {
      const stats = {
        downloads: this.db.prepare('SELECT COUNT(*) as count FROM downloads').get().count,
        playlists: this.db.prepare('SELECT COUNT(*) as count FROM playlists').get().count,
        playHistory: this.db.prepare('SELECT COUNT(*) as count FROM play_history').get().count,
        customSources: this.db.prepare('SELECT COUNT(*) as count FROM custom_sources').get().count,
        dbSize: fs.statSync(this.dbPath).size
      }
      return stats
    } catch (error) {
      console.error('[Database] 获取统计失败:', error)
      return null
    }
  }
}

module.exports = DatabaseManager
