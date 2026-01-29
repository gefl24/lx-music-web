/**
 * 音源管理 API 路由
 * 
 * 端点:
 * - GET /api/source/list - 获取源列表
 * - POST /api/source/upload - 上传自定义源
 * - DELETE /api/source/:id - 删除源
 * - POST /api/source/toggle - 启用/禁用源
 */

const express = require('express')
const multer = require('multer')
const crypto = require('crypto')
const router = express.Router()

// 配置文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/javascript' || 
        file.mimetype === 'text/javascript' ||
        file.originalname.endsWith('.js')) {
      cb(null, true)
    } else {
      cb(new Error('只允许上传 JavaScript 文件'))
    }
  }
})

/**
 * 获取源列表
 * GET /api/source/list
 */
router.get('/list', (req, res) => {
  try {
    const sourceEngine = req.app.get('sourceEngine')
    const db = req.app.get('db')
    
    // 从数据库获取已保存的源
    const savedSources = db.prepare(`
      SELECT id, name, description, version, author, homepage, enabled, created_at, updated_at
      FROM custom_sources
      ORDER BY created_at DESC
    `).all()
    
    // 获取当前运行中的源
    const runningSources = sourceEngine.getSources()
    
    res.json({
      success: true,
      data: {
        saved: savedSources,
        running: runningSources
      }
    })
  } catch (error) {
    console.error('[API] 获取源列表失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 上传自定义源
 * POST /api/source/upload
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: '没有上传文件'
    })
  }

  try {
    const sourceEngine = req.app.get('sourceEngine')
    const db = req.app.get('db')
    
    const scriptCode = req.file.buffer.toString('utf-8')
    
    // 生成源ID
    const sourceId = crypto.createHash('md5').update(scriptCode).digest('hex').substring(0, 16)
    
    console.log(`[API] 上传自定义源: ${sourceId}`)
    
    // 加载源到引擎
    const loadResult = await sourceEngine.loadSource(sourceId, scriptCode)
    
    // 保存到数据库
    const now = Date.now()
    db.prepare(`
      INSERT OR REPLACE INTO custom_sources 
      (id, name, description, version, author, homepage, script_content, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      sourceId,
      loadResult.metadata.name || 'Unknown',
      loadResult.metadata.description || '',
      loadResult.metadata.version || '1.0.0',
      loadResult.metadata.author || 'Unknown',
      loadResult.metadata.homepage || '',
      scriptCode,
      now,
      now
    )
    
    res.json({
      success: true,
      data: {
        sourceId,
        metadata: loadResult.metadata
      },
      message: '自定义源上传成功'
    })
  } catch (error) {
    console.error('[API] 上传自定义源失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 从数据库加载源
 * POST /api/source/load/:id
 */
router.post('/load/:id', async (req, res) => {
  const { id } = req.params

  try {
    const sourceEngine = req.app.get('sourceEngine')
    const db = req.app.get('db')
    
    // 从数据库获取源
    const source = db.prepare('SELECT * FROM custom_sources WHERE id = ?').get(id)
    
    if (!source) {
      return res.status(404).json({
        success: false,
        message: '源不存在'
      })
    }

    // 加载到引擎
    await sourceEngine.loadSource(id, source.script_content)
    
    res.json({
      success: true,
      message: '源加载成功'
    })
  } catch (error) {
    console.error('[API] 加载源失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 删除源
 * DELETE /api/source/:id
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params

  try {
    const sourceEngine = req.app.get('sourceEngine')
    const db = req.app.get('db')
    
    // 从引擎卸载
    sourceEngine.unloadSource(id)
    
    // 从数据库删除
    db.prepare('DELETE FROM custom_sources WHERE id = ?').run(id)
    
    res.json({
      success: true,
      message: '源已删除'
    })
  } catch (error) {
    console.error('[API] 删除源失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 启用/禁用源
 * POST /api/source/toggle
 */
router.post('/toggle', (req, res) => {
  const { sourceId, enabled } = req.body

  if (!sourceId || typeof enabled !== 'boolean') {
    return res.status(400).json({
      success: false,
      message: '参数错误'
    })
  }

  try {
    const sourceEngine = req.app.get('sourceEngine')
    const db = req.app.get('db')
    
    // 更新引擎状态
    sourceEngine.toggleSource(sourceId, enabled)
    
    // 更新数据库
    db.prepare(`
      UPDATE custom_sources SET enabled = ?, updated_at = ? WHERE id = ?
    `).run(enabled ? 1 : 0, Date.now(), sourceId)
    
    res.json({
      success: true,
      message: enabled ? '源已启用' : '源已禁用'
    })
  } catch (error) {
    console.error('[API] 切换源状态失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 导出源
 * GET /api/source/export/:id
 */
router.get('/export/:id', (req, res) => {
  const { id } = req.params

  try {
    const db = req.app.get('db')
    
    const source = db.prepare('SELECT * FROM custom_sources WHERE id = ?').get(id)
    
    if (!source) {
      return res.status(404).json({
        success: false,
        message: '源不存在'
      })
    }

    // 设置下载响应头
    res.setHeader('Content-Type', 'application/javascript')
    res.setHeader('Content-Disposition', `attachment; filename="${source.name}.js"`)
    res.send(source.script_content)
  } catch (error) {
    console.error('[API] 导出源失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 从 URL 导入源
 * POST /api/source/import-url
 */
router.post('/import-url', async (req, res) => {
  const { url } = req.body

  if (!url) {
    return res.status(400).json({
      success: false,
      message: '请提供源文件 URL'
    })
  }

  try {
    const sourceEngine = req.app.get('sourceEngine')
    const db = req.app.get('db')
    
    console.log(`[API] 从 URL 导入源: ${url}`)
    
    // 下载源文件
    const fetch = require('node-fetch')
    const response = await fetch(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'LX-Music-Web/1.0.0'
      }
    })
    
    if (!response.ok) {
      throw new Error(`下载失败: ${response.status} ${response.statusText}`)
    }
    
    const scriptCode = await response.text()
    
    // 生成源ID
    const sourceId = crypto.createHash('md5').update(scriptCode).digest('hex').substring(0, 16)
    
    // 加载源到引擎
    const loadResult = await sourceEngine.loadSource(sourceId, scriptCode)
    
    // 保存到数据库
    const now = Date.now()
    db.prepare(`
      INSERT OR REPLACE INTO custom_sources 
      (id, name, description, version, author, homepage, script_content, enabled, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(
      sourceId,
      loadResult.metadata.name || 'Unknown',
      loadResult.metadata.description || '',
      loadResult.metadata.version || '1.0.0',
      loadResult.metadata.author || 'Unknown',
      loadResult.metadata.homepage || '',
      scriptCode,
      now,
      now
    )
    
    res.json({
      success: true,
      data: {
        sourceId,
        metadata: loadResult.metadata,
        url
      },
      message: '从 URL 导入源成功'
    })
  } catch (error) {
    console.error('[API] 从 URL 导入源失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

module.exports = router
