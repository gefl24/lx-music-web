/**
 * 音乐标签路由
 * 
 * 端点:
 * - GET /api/tag/list - 获取所有标签
 * - POST /api/tag/create - 创建标签
 * - PUT /api/tag/:id - 更新标签
 * - DELETE /api/tag/:id - 删除标签
 * - POST /api/tag/song - 为歌曲添加标签
 * - DELETE /api/tag/song/:songId/:tagId - 移除歌曲标签
 * - GET /api/tag/:id/songs - 获取标签下的歌曲
 * - GET /api/tag/song/:songId - 获取歌曲的所有标签
 */

const express = require('express')
const router = express.Router()
const { authMiddleware } = require('../middleware/auth')

/**
 * 获取所有标签
 * GET /api/tag/list
 */
router.get('/list', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db')

    const tags = db.prepare(`
      SELECT 
        t.*,
        (SELECT COUNT(*) FROM song_tags WHERE tag_id = t.id AND user_id = ?) as song_count
      FROM tags t
      WHERE t.user_id = ?
      ORDER BY t.name ASC
    `).all(req.user.id, req.user.id)

    res.json({
      success: true,
      data: tags
    })
  } catch (error) {
    console.error('[API] 获取标签列表失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 创建标签
 * POST /api/tag/create
 */
router.post('/create', authMiddleware, (req, res) => {
  const { name, color, description } = req.body

  if (!name || !name.trim()) {
    return res.status(400).json({
      success: false,
      message: '标签名称不能为空'
    })
  }

  try {
    const db = req.app.get('db')

    // 检查标签是否已存在
    const existing = db.prepare(`
      SELECT id FROM tags WHERE user_id = ? AND name = ?
    `).get(req.user.id, name.trim())

    if (existing) {
      return res.status(400).json({
        success: false,
        message: '标签已存在'
      })
    }

    // 创建标签
    const tagId = `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    db.prepare(`
      INSERT INTO tags (
        id, user_id, name, color, description, created_at
      ) VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      tagId,
      req.user.id,
      name.trim(),
      color || '#409EFF',
      description || '',
      Date.now()
    )

    res.json({
      success: true,
      data: { id: tagId },
      message: '标签创建成功'
    })
  } catch (error) {
    console.error('[API] 创建标签失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 更新标签
 * PUT /api/tag/:id
 */
router.put('/:id', authMiddleware, (req, res) => {
  const { id } = req.params
  const { name, color, description } = req.body

  try {
    const db = req.app.get('db')

    // 检查标签所有权
    const tag = db.prepare(`
      SELECT id FROM tags WHERE id = ? AND user_id = ?
    `).get(id, req.user.id)

    if (!tag) {
      return res.status(404).json({
        success: false,
        message: '标签不存在'
      })
    }

    // 更新标签
    const updates = []
    const values = []

    if (name !== undefined) {
      updates.push('name = ?')
      values.push(name.trim())
    }
    if (color !== undefined) {
      updates.push('color = ?')
      values.push(color)
    }
    if (description !== undefined) {
      updates.push('description = ?')
      values.push(description)
    }

    updates.push('updated_at = ?')
    values.push(Date.now())
    values.push(id)

    db.prepare(`
      UPDATE tags SET ${updates.join(', ')} WHERE id = ?
    `).run(...values)

    res.json({
      success: true,
      message: '标签更新成功'
    })
  } catch (error) {
    console.error('[API] 更新标签失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 删除标签
 * DELETE /api/tag/:id
 */
router.delete('/:id', authMiddleware, (req, res) => {
  const { id } = req.params

  try {
    const db = req.app.get('db')

    // 检查标签所有权
    const tag = db.prepare(`
      SELECT id FROM tags WHERE id = ? AND user_id = ?
    `).get(id, req.user.id)

    if (!tag) {
      return res.status(404).json({
        success: false,
        message: '标签不存在'
      })
    }

    // 删除标签 (级联删除关联)
    db.prepare('DELETE FROM tags WHERE id = ?').run(id)

    res.json({
      success: true,
      message: '标签删除成功'
    })
  } catch (error) {
    console.error('[API] 删除标签失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 为歌曲添加标签
 * POST /api/tag/song
 */
router.post('/song', authMiddleware, (req, res) => {
  const { songInfo, source, tagId } = req.body

  if (!songInfo || !songInfo.id || !tagId) {
    return res.status(400).json({
      success: false,
      message: '参数不完整'
    })
  }

  try {
    const db = req.app.get('db')

    // 检查标签所有权
    const tag = db.prepare(`
      SELECT id FROM tags WHERE id = ? AND user_id = ?
    `).get(tagId, req.user.id)

    if (!tag) {
      return res.status(404).json({
        success: false,
        message: '标签不存在'
      })
    }

    // 检查是否已添加
    const existing = db.prepare(`
      SELECT id FROM song_tags 
      WHERE user_id = ? AND song_id = ? AND tag_id = ?
    `).get(req.user.id, songInfo.id, tagId)

    if (existing) {
      return res.status(400).json({
        success: false,
        message: '已添加该标签'
      })
    }

    // 添加标签
    const id = `st_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    db.prepare(`
      INSERT INTO song_tags (
        id, user_id, song_id, tag_id, song_info, source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      req.user.id,
      songInfo.id,
      tagId,
      JSON.stringify({ ...songInfo, source }),
      source || '',
      Date.now()
    )

    res.json({
      success: true,
      message: '标签添加成功'
    })
  } catch (error) {
    console.error('[API] 添加标签失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 移除歌曲标签
 * DELETE /api/tag/song/:songId/:tagId
 */
router.delete('/song/:songId/:tagId', authMiddleware, (req, res) => {
  const { songId, tagId } = req.params

  try {
    const db = req.app.get('db')

    // 删除关联
    const result = db.prepare(`
      DELETE FROM song_tags 
      WHERE user_id = ? AND song_id = ? AND tag_id = ?
    `).run(req.user.id, songId, tagId)

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: '标签关联不存在'
      })
    }

    res.json({
      success: true,
      message: '标签移除成功'
    })
  } catch (error) {
    console.error('[API] 移除标签失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 获取标签下的歌曲
 * GET /api/tag/:id/songs
 */
router.get('/:id/songs', authMiddleware, (req, res) => {
  const { id } = req.params
  const { page = 1, limit = 50 } = req.query

  try {
    const db = req.app.get('db')

    // 检查标签所有权
    const tag = db.prepare(`
      SELECT * FROM tags WHERE id = ? AND user_id = ?
    `).get(id, req.user.id)

    if (!tag) {
      return res.status(404).json({
        success: false,
        message: '标签不存在'
      })
    }

    const offset = (parseInt(page) - 1) * parseInt(limit)

    // 获取歌曲列表
    const songs = db.prepare(`
      SELECT id, song_id, song_info, source, created_at
      FROM song_tags
      WHERE user_id = ? AND tag_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(req.user.id, id, parseInt(limit), offset)

    // 解析歌曲信息
    const songList = songs.map(s => ({
      ...JSON.parse(s.song_info),
      taggedAt: s.created_at
    }))

    // 获取总数
    const total = db.prepare(`
      SELECT COUNT(*) as count 
      FROM song_tags 
      WHERE user_id = ? AND tag_id = ?
    `).get(req.user.id, id).count

    res.json({
      success: true,
      data: {
        tag,
        songs: songList,
        total,
        page: parseInt(page),
        limit: parseInt(limit)
      }
    })
  } catch (error) {
    console.error('[API] 获取标签歌曲失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 获取歌曲的所有标签
 * GET /api/tag/song/:songId
 */
router.get('/song/:songId', authMiddleware, (req, res) => {
  const { songId } = req.params

  try {
    const db = req.app.get('db')

    // 获取歌曲的标签
    const tags = db.prepare(`
      SELECT t.*, st.created_at as tagged_at
      FROM song_tags st
      JOIN tags t ON st.tag_id = t.id
      WHERE st.user_id = ? AND st.song_id = ?
      ORDER BY st.created_at DESC
    `).all(req.user.id, songId)

    res.json({
      success: true,
      data: tags
    })
  } catch (error) {
    console.error('[API] 获取歌曲标签失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

module.exports = router
