/**
 * 音乐相关 API 路由
 * 
 * 端点:
 * - POST /api/music/search - 搜索音乐
 * - POST /api/music/url - 获取播放链接
 * - POST /api/music/lyric - 获取歌词
 * - GET /api/music/leaderboard - 获取榜单
 */

const express = require('express')
const router = express.Router()

/**
 * 搜索音乐
 * POST /api/music/search
 */
router.post('/search', async (req, res) => {
  const { keyword, source, page = 1, limit = 30 } = req.body

  // 参数验证
  if (!keyword || !source) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数: keyword 或 source'
    })
  }

  try {
    const sourceEngine = req.app.get('sourceEngine')
    
    console.log(`[API] 搜索音乐: ${keyword} (源: ${source}, 页: ${page})`)
    
    const results = await sourceEngine.search(source, keyword, page, limit)
    
    res.json({
      success: true,
      data: {
        list: results,
        keyword,
        source,
        page,
        limit
      }
    })
  } catch (error) {
    console.error('[API] 搜索失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 获取音乐播放链接
 * POST /api/music/url
 */
router.post('/url', async (req, res) => {
  const { songInfo, quality = '128k', source } = req.body

  if (!songInfo || !source) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数: songInfo 或 source'
    })
  }

  try {
    const sourceEngine = req.app.get('sourceEngine')
    
    console.log(`[API] 获取播放链接: ${songInfo.name} (质量: ${quality})`)
    
    const urlResult = await sourceEngine.getMusicUrl(source, songInfo, quality)
    
    // 处理不同格式的返回值
    let url
    if (typeof urlResult === 'string') {
      url = urlResult
    } else if (urlResult && urlResult.url) {
      url = urlResult.url
    } else {
      throw new Error('无效的返回格式')
    }

    res.json({
      success: true,
      data: {
        url,
        quality,
        songInfo
      }
    })
  } catch (error) {
    console.error('[API] 获取播放链接失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 获取歌词
 * POST /api/music/lyric
 */
router.post('/lyric', async (req, res) => {
  const { songInfo, source } = req.body

  if (!songInfo || !source) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数: songInfo 或 source'
    })
  }

  try {
    const sourceEngine = req.app.get('sourceEngine')
    
    console.log(`[API] 获取歌词: ${songInfo.name}`)
    
    const lyric = await sourceEngine.getLyric(source, songInfo)
    
    res.json({
      success: true,
      data: {
        lyric,
        songInfo
      }
    })
  } catch (error) {
    console.error('[API] 获取歌词失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 获取榜单列表
 * GET /api/music/leaderboard/:source
 */
router.get('/leaderboard/:source', async (req, res) => {
  const { source } = req.params

  try {
    const sourceEngine = req.app.get('sourceEngine')
    
    console.log(`[API] 获取榜单: ${source}`)
    
    const leaderboard = await sourceEngine.getLeaderboard(source)
    
    res.json({
      success: true,
      data: leaderboard
    })
  } catch (error) {
    console.error('[API] 获取榜单失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 获取歌单详情
 * GET /api/music/songlist/:source/:id
 */
router.get('/songlist/:source/:id', async (req, res) => {
  const { source, id } = req.params

  try {
    const sourceEngine = req.app.get('sourceEngine')
    
    console.log(`[API] 获取歌单: ${id} (源: ${source})`)
    
    const songlist = await sourceEngine.callMethod(source, 'getSonglistDetail', { id })
    
    res.json({
      success: true,
      data: songlist
    })
  } catch (error) {
    console.error('[API] 获取歌单失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

module.exports = router
