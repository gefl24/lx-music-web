/**
 * 下载相关 API 路由
 * 
 * 端点:
 * - POST /api/download/add - 添加下载任务
 * - GET /api/download/list - 获取下载列表
 * - POST /api/download/pause - 暂停下载
 * - POST /api/download/resume - 恢复下载
 * - DELETE /api/download/:id - 删除任务
 */

const express = require('express')
const router = express.Router()

/**
 * 添加下载任务
 * POST /api/download/add
 */
router.post('/add', async (req, res) => {
  const { songInfo, quality = '128k', source } = req.body

  if (!songInfo || !source) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数: songInfo 或 source'
    })
  }

  try {
    const downloadManager = req.app.get('downloadManager')
    
    console.log(`[API] 添加下载: ${songInfo.name} (质量: ${quality})`)
    
    const result = await downloadManager.addTask(songInfo, quality, source)
    
    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('[API] 添加下载失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 获取下载列表
 * GET /api/download/list
 */
router.get('/list', (req, res) => {
  const { status, limit = 100 } = req.query

  try {
    const downloadManager = req.app.get('downloadManager')
    
    const tasks = downloadManager.getTasks(status, parseInt(limit))
    
    res.json({
      success: true,
      data: {
        tasks,
        total: tasks.length
      }
    })
  } catch (error) {
    console.error('[API] 获取下载列表失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 获取任务详情
 * GET /api/download/:id
 */
router.get('/:id', (req, res) => {
  const { id } = req.params

  try {
    const downloadManager = req.app.get('downloadManager')
    
    const task = downloadManager.getTask(id)
    
    if (!task) {
      return res.status(404).json({
        success: false,
        message: '任务不存在'
      })
    }

    res.json({
      success: true,
      data: task
    })
  } catch (error) {
    console.error('[API] 获取任务详情失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 暂停下载
 * POST /api/download/pause
 */
router.post('/pause', (req, res) => {
  const { taskId } = req.body

  if (!taskId) {
    return res.status(400).json({
      success: false,
      message: '缺少参数: taskId'
    })
  }

  try {
    const downloadManager = req.app.get('downloadManager')
    
    const success = downloadManager.pauseTask(taskId)
    
    res.json({
      success,
      message: success ? '任务已暂停' : '暂停失败'
    })
  } catch (error) {
    console.error('[API] 暂停任务失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 恢复下载
 * POST /api/download/resume
 */
router.post('/resume', (req, res) => {
  const { taskId } = req.body

  if (!taskId) {
    return res.status(400).json({
      success: false,
      message: '缺少参数: taskId'
    })
  }

  try {
    const downloadManager = req.app.get('downloadManager')
    
    const success = downloadManager.resumeTask(taskId)
    
    res.json({
      success,
      message: success ? '任务已恢复' : '恢复失败'
    })
  } catch (error) {
    console.error('[API] 恢复任务失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 删除任务
 * DELETE /api/download/:id
 */
router.delete('/:id', (req, res) => {
  const { id } = req.params

  try {
    const downloadManager = req.app.get('downloadManager')
    
    const success = downloadManager.deleteTask(id)
    
    res.json({
      success,
      message: success ? '任务已删除' : '删除失败'
    })
  } catch (error) {
    console.error('[API] 删除任务失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 获取下载统计
 * GET /api/download/stats
 */
router.get('/stats', (req, res) => {
  try {
    const downloadManager = req.app.get('downloadManager')
    
    const stats = downloadManager.getStats()
    
    res.json({
      success: true,
      data: stats
    })
  } catch (error) {
    console.error('[API] 获取统计失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

module.exports = router
