/**
 * 歌单管理路由
 * 
 * 端点:
 * - GET /api/playlist/list - 获取歌单列表
 * - POST /api/playlist/create - 创建歌单
 * - GET /api/playlist/:id - 获取歌单详情
 * - PUT /api/playlist/:id - 更新歌单
 * - DELETE /api/playlist/:id - 删除歌单
 * - POST /api/playlist/:id/songs - 添加歌曲到歌单
 * - DELETE /api/playlist/:id/songs/:songId - 从歌单移除歌曲
 * - PUT /api/playlist/:id/songs/order - 调整歌曲顺序
 */

const express = require('express')
const router = express.Router()
const { authMiddleware, optionalAuthMiddleware } = require('../middleware/auth')

/**
 * 获取歌单列表
 * GET /api/playlist/list
 */
router.get('/list', optionalAuthMiddleware, (req, res) => {
  try {
    const db = req.app.get('db')
    const userId = req.user?.id

    let playlists
    
    if (userId) {
      // 获取用户的歌单
      playlists = db.prepare(`
        SELECT 
          p.*,
          (SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = p.id) as song_count
        FROM playlists p
        WHERE p.user_id = ? OR p.is_public = 1
        ORDER BY p.created_at DESC
      `).all(userId)
    } else {
      // 只获取公开歌单
      playlists = db.prepare(`
        SELECT 
          p.*,
          (SELECT COUNT(*) FROM playlist_songs WHERE playlist_id = p.id) as song_count
        FROM playlists p
        WHERE p.is_public = 1
        ORDER BY p.created_at DESC
      `).all()
    }

    res.json({
      success: true,
      data: playlists
    })
  } catch (error) {
    console.error('[API] 获取歌单列表失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 创建歌单
 * POST /api/playlist/create
 */
router.post('/create', authMiddleware, (req, res) => {
  const { name, description, coverUrl, isPublic = false } = req.body

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: '歌单名称不能为空'
    })
  }

  try {
    const db = req.app.get('db')
    const playlistId = `playlist_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    db.prepare(`
      INSERT INTO playlists (
        id, user_id, name, description, cover_url, is_public, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      playlistId,
      req.user.id,
      name.trim(),
      description || '',
      coverUrl || null,
      isPublic ? 1 : 0,
      Date.now()
    )

    res.json({
      success: true,
      data: { id: playlistId },
      message: '歌单创建成功'
    })
  } catch (error) {
    console.error('[API] 创建歌单失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 获取歌单详情
 * GET /api/playlist/:id
 */
router.get('/:id', optionalAuthMiddleware, (req, res) => {
  const { id } = req.params

  try {
    const db = req.app.get('db')

    // 获取歌单信息
    const playlist = db.prepare(`
      SELECT p.*, u.username as creator_username
      FROM playlists p
      LEFT JOIN users u ON p.user_id = u.id
      WHERE p.id = ?
    `).get(id)

    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: '歌单不存在'
      })
    }

    // 检查权限
    if (!playlist.is_public && (!req.user || playlist.user_id !== req.user.id)) {
      return res.status(403).json({
        success: false,
        message: '无权访问此歌单'
      })
    }

    // 获取歌单中的歌曲
    const songs = db.prepare(`
      SELECT 
        ps.id,
        ps.song_info,
        ps.sort_order,
        ps.added_at
      FROM playlist_songs ps
      WHERE ps.playlist_id = ?
      ORDER BY ps.sort_order ASC, ps.added_at DESC
    `).all(id)

    // 解析歌曲信息
    const songList = songs.map(s => ({
      id: s.id,
      ...JSON.parse(s.song_info),
      sortOrder: s.sort_order,
      addedAt: s.added_at
    }))

    res.json({
      success: true,
      data: {
        ...playlist,
        songs: songList,
        songCount: songList.length
      }
    })
  } catch (error) {
    console.error('[API] 获取歌单详情失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 更新歌单
 * PUT /api/playlist/:id
 */
router.put('/:id', authMiddleware, (req, res) => {
  const { id } = req.params
  const { name, description, coverUrl, isPublic } = req.body

  try {
    const db = req.app.get('db')

    // 检查歌单所有权
    const playlist = db.prepare('SELECT user_id FROM playlists WHERE id = ?').get(id)
    
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: '歌单不存在'
      })
    }

    if (playlist.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '无权修改此歌单'
      })
    }

    // 更新歌单
    const updates = []
    const values = []

    if (name !== undefined) {
      updates.push('name = ?')
      values.push(name.trim())
    }
    if (description !== undefined) {
      updates.push('description = ?')
      values.push(description)
    }
    if (coverUrl !== undefined) {
      updates.push('cover_url = ?')
      values.push(coverUrl)
    }
    if (isPublic !== undefined) {
      updates.push('is_public = ?')
      values.push(isPublic ? 1 : 0)
    }

    updates.push('updated_at = ?')
    values.push(Date.now())
    values.push(id)

    db.prepare(`
      UPDATE playlists SET ${updates.join(', ')} WHERE id = ?
    `).run(...values)

    res.json({
      success: true,
      message: '歌单更新成功'
    })
  } catch (error) {
    console.error('[API] 更新歌单失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 删除歌单
 * DELETE /api/playlist/:id
 */
router.delete('/:id', authMiddleware, (req, res) => {
  const { id } = req.params

  try {
    const db = req.app.get('db')

    // 检查歌单所有权
    const playlist = db.prepare('SELECT user_id FROM playlists WHERE id = ?').get(id)
    
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: '歌单不存在'
      })
    }

    if (playlist.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '无权删除此歌单'
      })
    }

    // 删除歌单 (级联删除歌曲)
    db.prepare('DELETE FROM playlists WHERE id = ?').run(id)

    res.json({
      success: true,
      message: '歌单删除成功'
    })
  } catch (error) {
    console.error('[API] 删除歌单失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 添加歌曲到歌单
 * POST /api/playlist/:id/songs
 */
router.post('/:id/songs', authMiddleware, (req, res) => {
  const { id } = req.params
  const { songInfo, source } = req.body

  if (!songInfo || !songInfo.id) {
    return res.status(400).json({
      success: false,
      message: '歌曲信息不完整'
    })
  }

  try {
    const db = req.app.get('db')

    // 检查歌单所有权
    const playlist = db.prepare('SELECT user_id FROM playlists WHERE id = ?').get(id)
    
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: '歌单不存在'
      })
    }

    if (playlist.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '无权修改此歌单'
      })
    }

    // 检查歌曲是否已存在
    const existing = db.prepare(`
      SELECT id FROM playlist_songs 
      WHERE playlist_id = ? AND song_id = ?
    `).get(id, songInfo.id)

    if (existing) {
      return res.status(400).json({
        success: false,
        message: '歌曲已在歌单中'
      })
    }

    // 获取当前最大排序号
    const maxOrder = db.prepare(`
      SELECT COALESCE(MAX(sort_order), -1) as max_order 
      FROM playlist_songs WHERE playlist_id = ?
    `).get(id).max_order

    // 添加歌曲
    const songId = `ps_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    db.prepare(`
      INSERT INTO playlist_songs (
        id, playlist_id, song_id, song_info, source, sort_order, added_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      songId,
      id,
      songInfo.id,
      JSON.stringify({ ...songInfo, source }),
      source || '',
      maxOrder + 1,
      Date.now()
    )

    // 更新歌单的歌曲数量
    db.prepare(`
      UPDATE playlists SET updated_at = ? WHERE id = ?
    `).run(Date.now(), id)

    res.json({
      success: true,
      message: '歌曲添加成功'
    })
  } catch (error) {
    console.error('[API] 添加歌曲失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 从歌单移除歌曲
 * DELETE /api/playlist/:id/songs/:songId
 */
router.delete('/:id/songs/:songId', authMiddleware, (req, res) => {
  const { id, songId } = req.params

  try {
    const db = req.app.get('db')

    // 检查歌单所有权
    const playlist = db.prepare('SELECT user_id FROM playlists WHERE id = ?').get(id)
    
    if (!playlist) {
      return res.status(404).json({
        success: false,
        message: '歌单不存在'
      })
    }

    if (playlist.user_id !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: '无权修改此歌单'
      })
    }

    // 删除歌曲
    db.prepare(`
      DELETE FROM playlist_songs WHERE playlist_id = ? AND id = ?
    `).run(id, songId)

    // 更新歌单时间
    db.prepare(`
      UPDATE playlists SET updated_at = ? WHERE id = ?
    `).run(Date.now(), id)

    res.json({
      success: true,
      message: '歌曲移除成功'
    })
  } catch (error) {
    console.error('[API] 移除歌曲失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

module.exports = router
