/**
 * 用户管理路由
 * 
 * 端点:
 * - POST /api/user/register - 注册
 * - POST /api/user/login - 登录
 * - GET /api/user/profile - 获取个人信息
 * - PUT /api/user/profile - 更新个人信息
 * - PUT /api/user/password - 修改密码
 */

const express = require('express')
const router = express.Router()
const {
  generateToken,
  hashPassword,
  verifyPassword,
  authMiddleware
} = require('../middleware/auth')

/**
 * 注册
 * POST /api/user/register
 */
router.post('/register', async (req, res) => {
  const { username, password, email } = req.body

  // 参数验证
  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: '用户名和密码不能为空'
    })
  }

  if (username.length < 3 || username.length > 20) {
    return res.status(400).json({
      success: false,
      message: '用户名长度应在 3-20 个字符之间'
    })
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: '密码长度至少 6 个字符'
    })
  }

  try {
    const db = req.app.get('db')

    // 检查用户名是否已存在
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username)
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '用户名已存在'
      })
    }

    // 加密密码
    const { hash, salt } = hashPassword(password)

    // 创建用户
    const userId = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    db.prepare(`
      INSERT INTO users (id, username, password_hash, password_salt, email, role, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, username, hash, salt, email || null, 'user', Date.now())

    // 生成 token
    const token = generateToken({
      id: userId,
      username,
      role: 'user'
    })

    res.json({
      success: true,
      data: {
        user: {
          id: userId,
          username,
          email,
          role: 'user'
        },
        token
      },
      message: '注册成功'
    })
  } catch (error) {
    console.error('[API] 注册失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 登录
 * POST /api/user/login
 */
router.post('/login', (req, res) => {
  const { username, password } = req.body

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      message: '用户名和密码不能为空'
    })
  }

  try {
    const db = req.app.get('db')

    // 查找用户
    const user = db.prepare(`
      SELECT id, username, password_hash, password_salt, email, role, avatar, created_at
      FROM users WHERE username = ?
    `).get(username)

    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      })
    }

    // 验证密码
    if (!verifyPassword(password, user.password_hash, user.password_salt)) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      })
    }

    // 更新最后登录时间
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(Date.now(), user.id)

    // 生成 token
    const token = generateToken({
      id: user.id,
      username: user.username,
      role: user.role
    })

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          createdAt: user.created_at
        },
        token
      },
      message: '登录成功'
    })
  } catch (error) {
    console.error('[API] 登录失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 获取个人信息
 * GET /api/user/profile
 */
router.get('/profile', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db')

    const user = db.prepare(`
      SELECT id, username, email, role, avatar, bio, created_at, last_login_at
      FROM users WHERE id = ?
    `).get(req.user.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      })
    }

    res.json({
      success: true,
      data: user
    })
  } catch (error) {
    console.error('[API] 获取个人信息失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 更新个人信息
 * PUT /api/user/profile
 */
router.put('/profile', authMiddleware, (req, res) => {
  const { email, avatar, bio } = req.body

  try {
    const db = req.app.get('db')

    db.prepare(`
      UPDATE users 
      SET email = ?, avatar = ?, bio = ?, updated_at = ?
      WHERE id = ?
    `).run(email || null, avatar || null, bio || null, Date.now(), req.user.id)

    res.json({
      success: true,
      message: '信息更新成功'
    })
  } catch (error) {
    console.error('[API] 更新个人信息失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

/**
 * 修改密码
 * PUT /api/user/password
 */
router.put('/password', authMiddleware, (req, res) => {
  const { oldPassword, newPassword } = req.body

  if (!oldPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: '旧密码和新密码不能为空'
    })
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: '新密码长度至少 6 个字符'
    })
  }

  try {
    const db = req.app.get('db')

    // 获取当前密码
    const user = db.prepare(`
      SELECT password_hash, password_salt FROM users WHERE id = ?
    `).get(req.user.id)

    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      })
    }

    // 验证旧密码
    if (!verifyPassword(oldPassword, user.password_hash, user.password_salt)) {
      return res.status(401).json({
        success: false,
        message: '旧密码错误'
      })
    }

    // 加密新密码
    const { hash, salt } = hashPassword(newPassword)

    // 更新密码
    db.prepare(`
      UPDATE users 
      SET password_hash = ?, password_salt = ?, updated_at = ?
      WHERE id = ?
    `).run(hash, salt, Date.now(), req.user.id)

    res.json({
      success: true,
      message: '密码修改成功'
    })
  } catch (error) {
    console.error('[API] 修改密码失败:', error)
    res.status(500).json({
      success: false,
      message: error.message
    })
  }
})

module.exports = router
