/**
 * 用户认证管理器
 * 支持用户注册、登录、JWT Token 管理
 */

const crypto = require('crypto')
const jwt = require('jsonwebtoken')

class AuthManager {
  constructor(database, options = {}) {
    this.db = database
    this.jwtSecret = options.jwtSecret || this.generateSecret()
    this.tokenExpiry = options.tokenExpiry || '7d'
    this.saltRounds = 10
    
    console.log('[AuthManager] 初始化完成')
  }

  /**
   * 生成随机密钥
   */
  generateSecret() {
    return crypto.randomBytes(64).toString('hex')
  }

  /**
   * 密码加密
   */
  hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex')
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
    return { salt, hash }
  }

  /**
   * 验证密码
   */
  verifyPassword(password, salt, hash) {
    const hashToVerify = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
    return hash === hashToVerify
  }

  /**
   * 生成 JWT Token
   */
  generateToken(user) {
    const payload = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role || 'user'
    }
    
    return jwt.sign(payload, this.jwtSecret, {
      expiresIn: this.tokenExpiry
    })
  }

  /**
   * 验证 Token
   */
  verifyToken(token) {
    try {
      return jwt.verify(token, this.jwtSecret)
    } catch (error) {
      return null
    }
  }

  /**
   * 用户注册
   */
  async register(username, email, password) {
    // 检查用户名是否已存在
    const existingUser = this.db.prepare(
      'SELECT id FROM users WHERE username = ? OR email = ?'
    ).get(username, email)

    if (existingUser) {
      throw new Error('用户名或邮箱已存在')
    }

    // 验证密码强度
    if (password.length < 6) {
      throw new Error('密码长度至少为 6 位')
    }

    // 加密密码
    const { salt, hash } = this.hashPassword(password)

    // 创建用户
    const userId = this.generateUserId()
    const now = Date.now()

    this.db.prepare(`
      INSERT INTO users (
        id, username, email, password_hash, password_salt,
        role, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(userId, username, email, hash, salt, 'user', now, now)

    console.log(`[AuthManager] 用户注册成功: ${username}`)

    // 返回用户信息 (不包含密码)
    return this.getUserById(userId)
  }

  /**
   * 用户登录
   */
  async login(username, password) {
    // 查找用户
    const user = this.db.prepare(`
      SELECT * FROM users WHERE username = ? OR email = ?
    `).get(username, username)

    if (!user) {
      throw new Error('用户名或密码错误')
    }

    // 验证密码
    if (!this.verifyPassword(password, user.password_salt, user.password_hash)) {
      throw new Error('用户名或密码错误')
    }

    // 更新最后登录时间
    this.db.prepare(`
      UPDATE users SET last_login_at = ? WHERE id = ?
    `).run(Date.now(), user.id)

    // 生成 Token
    const token = this.generateToken(user)

    console.log(`[AuthManager] 用户登录成功: ${username}`)

    return {
      token,
      user: this.sanitizeUser(user)
    }
  }

  /**
   * 通过 Token 获取用户
   */
  getUserByToken(token) {
    const decoded = this.verifyToken(token)
    if (!decoded) {
      return null
    }

    return this.getUserById(decoded.id)
  }

  /**
   * 通过 ID 获取用户
   */
  getUserById(userId) {
    const user = this.db.prepare(
      'SELECT * FROM users WHERE id = ?'
    ).get(userId)

    return user ? this.sanitizeUser(user) : null
  }

  /**
   * 更新用户信息
   */
  updateUser(userId, updates) {
    const allowedFields = ['email', 'avatar', 'bio']
    const fields = []
    const values = []

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        fields.push(`${key} = ?`)
        values.push(value)
      }
    }

    if (fields.length === 0) {
      throw new Error('没有可更新的字段')
    }

    fields.push('updated_at = ?')
    values.push(Date.now())
    values.push(userId)

    this.db.prepare(`
      UPDATE users SET ${fields.join(', ')} WHERE id = ?
    `).run(...values)

    return this.getUserById(userId)
  }

  /**
   * 修改密码
   */
  changePassword(userId, oldPassword, newPassword) {
    const user = this.db.prepare(
      'SELECT password_hash, password_salt FROM users WHERE id = ?'
    ).get(userId)

    if (!user) {
      throw new Error('用户不存在')
    }

    // 验证旧密码
    if (!this.verifyPassword(oldPassword, user.password_salt, user.password_hash)) {
      throw new Error('原密码错误')
    }

    // 验证新密码
    if (newPassword.length < 6) {
      throw new Error('新密码长度至少为 6 位')
    }

    // 加密新密码
    const { salt, hash } = this.hashPassword(newPassword)

    // 更新密码
    this.db.prepare(`
      UPDATE users 
      SET password_hash = ?, password_salt = ?, updated_at = ?
      WHERE id = ?
    `).run(hash, salt, Date.now(), userId)

    console.log(`[AuthManager] 用户修改密码成功: ${userId}`)

    return true
  }

  /**
   * 删除用户
   */
  deleteUser(userId) {
    this.db.prepare('DELETE FROM users WHERE id = ?').run(userId)
    console.log(`[AuthManager] 用户已删除: ${userId}`)
    return true
  }

  /**
   * 获取用户列表
   */
  getUsers(options = {}) {
    const { limit = 100, offset = 0, role } = options

    let query = 'SELECT * FROM users'
    const params = []

    if (role) {
      query += ' WHERE role = ?'
      params.push(role)
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?'
    params.push(limit, offset)

    const users = this.db.prepare(query).all(...params)

    return users.map(u => this.sanitizeUser(u))
  }

  /**
   * 生成用户 ID
   */
  generateUserId() {
    return `user_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`
  }

  /**
   * 清理用户敏感信息
   */
  sanitizeUser(user) {
    const { password_hash, password_salt, ...safeUser } = user
    return safeUser
  }

  /**
   * 创建默认管理员账户
   */
  createDefaultAdmin() {
    try {
      const adminExists = this.db.prepare(
        'SELECT id FROM users WHERE role = ?'
      ).get('admin')

      if (!adminExists) {
        const { salt, hash } = this.hashPassword('admin123')
        const userId = this.generateUserId()
        const now = Date.now()

        this.db.prepare(`
          INSERT INTO users (
            id, username, email, password_hash, password_salt,
            role, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          userId,
          'admin',
          'admin@lxmusic.local',
          hash,
          salt,
          'admin',
          now,
          now
        )

        console.log('[AuthManager] 默认管理员账户已创建')
        console.log('  用户名: admin')
        console.log('  密码: admin123')
        console.log('  请尽快修改密码!')
      }
    } catch (error) {
      console.error('[AuthManager] 创建默认管理员失败:', error)
    }
  }
}

module.exports = AuthManager
