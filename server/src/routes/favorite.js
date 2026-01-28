/**
 * 收藏订阅路由
 * 
 * 端点:
 * - POST /api/favorite/song - 收藏歌曲
 * - DELETE /api/favorite/song/:id - 取消收藏歌曲
 * - GET /api/favorite/songs - 获取收藏的歌曲
 * - POST /api/favorite/playlist - 订阅歌单
 * - DELETE /api/favorite/playlist/:id - 取消订阅歌单
 * - GET /api/favorite/playlists - 获取订阅的歌单
 * - GET /api/favorite/check - 检查收藏状态
 */

const express = require('express')
const router = express.Router()
const { authMiddleware } = require('../middleware/auth')

/**
 * 收藏歌曲
 * POST /api/favorite/song
 */
router.post('/song', authMiddleware, (req, res) => {
  const { songInfo, source } = req.body

  if (!songInfo || !songInfo.id) {
    return res.status(400).json({
      success: false,
      message: '歌曲信息不完整'
    })
  }

  try {
    const db = req.app.get('db')

    // 检查是否已收藏
    const existing = db.prepare(`
      SELECT id FROM favorite_songs 
      WHERE user_id = ? AND song_id = ?
    `).get(req.user.id, songInfo.id)

    if (existing) {
      return res.status(400).json({
        success: false,
        message: '已收藏该歌曲'
      })
    }

    // 添加收藏
    const favoriteId = `fav_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    db.prepare(`
      INSERT INTO favorite_songs (
        id, user_id, song_id, song_info, source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      favoriteId,
      req.user.id,
      songInfo.id,
      JSON.stringify({ ...songInfo, source }),
      source || '',
      Date.now()
    )

    res.json({
      success: true,
      data: { id: favoriteId },
      message: '收藏成功'
    })
  } catch (error) {
    console.error('[API] 收藏歌曲失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 取消收藏歌曲
 * DELETE /api/favorite/song/:id
 */
router.delete('/song/:id', authMiddleware, (req, res) => {
  const { id } = req.params

  try {
    const db = req.app.get('db')

    // 删除收藏 (只能删除自己的)
    const result = db.prepare(`
      DELETE FROM favorite_songs 
      WHERE user_id = ? AND (id = ? OR song_id = ?)
    `).run(req.user.id, id, id)

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: '收藏不存在'
      })
    }

    res.json({
      success: true,
      message: '取消收藏成功'
    })
  } catch (error) {
    console.error('[API] 取消收藏失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 获取收藏的歌曲
 * GET /api/favorite/songs
 */
router.get('/songs', authMiddleware, (req, res) => {
  const { page = 1, limit = 50 } = req.query

  try {
    const db = req.app.get('db')

    const offset = (parseInt(page) - 1) * parseInt(limit)

    // 获取收藏列表
    const favorites = db.prepare(`
      SELECT id, song_id, song_info, source, created_at
      FROM favorite_songs
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(req.user.id, parseInt(limit), offset)

    // 解析歌曲信息
    const songs = favorites.map(f => ({
      favoriteId: f.id,
      ...JSON.parse(f.song_info),
      favoritedAt: f.created_at
    }))

    // 获取总数
    const total = db.prepare(`
      SELECT COUNT(*) as count FROM favorite_songs WHERE user_id = ?
    `).get(req.user.id).count

    res.json({
      success: true,
      data: {
        songs,
        total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    })
  } catch (error) {
    console.error('[API] 获取收藏列表失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 订阅歌单
 * POST /api/favorite/playlist
 */
router.post('/playlist', authMiddleware, (req, res) => {
  const { playlistId } = req.body

  if (!playlistId) {
    return res.status(400).json({
      success: false,
      message: '歌单 ID 不能为空'
    })
  }

  try {
    const db = req.app.get('db')

    // 检查歌单是否存在
    const playlist = db.prepare(`
      SELECT id, user_id, is_public FROM playlists WHERE id = ?
    `).get(playlistId)

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: '歌单不存在'
      })
    }

    // 不能订阅自己的歌单
    if (playlist.user_id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: '不能订阅自己的歌单'
      })
    }

    // 检查是否为公开歌单
    if (!playlist.is_public) {
      return res.status(403).json({
        success: false,
        message: '该歌单未公开'
      })
    }

    // 检查是否已订阅
    const existing = db.prepare(`
      SELECT id FROM favorite_playlists 
      WHERE user_id = ? AND playlist_id = ?
    `).get(req.user.id, playlistId)

    if (existing) {
      return res.status(400).json({
        success: false,
        message: '已订阅该歌单'
      })
    }

    // 添加订阅
    const favoriteId = `fp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    db.prepare(`
      INSERT INTO favorite_playlists (
        id, user_id, playlist_id, created_at
      ) VALUES (?, ?, ?, ?)
    `).run(favoriteId, req.user.id, playlistId, Date.now())

    res.json({
      success: true,
      data: { id: favoriteId },
      message: '订阅成功'
    })
  } catch (error) {
    console.error('[API] 订阅歌单失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 取消订阅歌单
 * DELETE /api/favorite/playlist/:id
 */
router.delete('/playlist/:id', authMiddleware, (req, res) => {
  const { id } = req.params

  try {
    const db = req.app.get('db')

    // 删除订阅
    const result = db.prepare(`
      DELETE FROM favorite_playlists 
      WHERE user_id = ? AND (id = ? OR playlist_id = ?)
    `).run(req.user.id, id, id)

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: '订阅不存在'
      })
    }

    res.json({
      success: true,
      message: '取消订阅成功'
    })
  } catch (error) {
    console.error('[API] 取消订阅失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 获取订阅的歌单
 * GET /api/favorite/playlists
 */
router.get('/playlists', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db')

    // 获取订阅列表
    const favorites = db.prepare(`
      SELECT 
        fp.id as favorite_id,
        fp.created_at as favorited_at,
        p.*,
        u.username as creator_username,
        (SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = p.id) as song_count
      FROM favorite_playlists fp
      JOIN playlists p ON fp.playlist_id = p.id
      LEFT JOIN users u ON p.user_id = u.id
      WHERE fp.user_id = ?
      ORDER BY fp.created_at DESC
    `).all(req.user.id)

    res.json({
      success: true,
      data: favorites
    })
  } catch (error) {
    console.error('[API] 获取订阅列表失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 检查收藏状态
 * GET /api/favorite/check?songIds=xxx,yyy&playlistIds=aaa,bbb
 */
router.get('/check', authMiddleware, (req, res) => {
  const { songIds, playlistIds } = req.query

  try {
    const db = req.app.get('db')
    const result = {
      songs: {},
      playlists: {}
    }

    // 检查歌曲收藏状态
    if (songIds) {
      const ids = songIds.split(',').filter(Boolean)
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',')
        const favorites = db.prepare(`
          SELECT song_id FROM favorite_songs 
          WHERE user_id = ? AND song_id IN (${placeholders})
        `).all(req.user.id, ...ids)

        favorites.forEach(f => {
          result.songs[f.song_id] = true
        })

        ids.forEach(id => {
          if (!result.songs[id]) {
            result.songs[id] = false
          }
        })
      }
    }

    // 检查歌单订阅状态
    if (playlistIds) {
      const ids = playlistIds.split(',').filter(Boolean)
      if (ids.length > 0) {
        const placeholders = ids.map(() => '?').join(',')
        const favorites = db.prepare(`
          SELECT playlist_id FROM favorite_playlists 
          WHERE user_id = ? AND playlist_id IN (${placeholders})
        `).all(req.user.id, ...ids)

        favorites.forEach(f => {
          result.playlists[f.playlist_id] = true
        })

        ids.forEach(id => {
          if (!result.playlists[id]) {
            result.playlists[id] = false
          }
        })
      }
    }

    res.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('[API] 检查收藏状态失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

module.exports = router
