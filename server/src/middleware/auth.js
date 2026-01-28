/**
 * 用户认证中间件
 */

const jwt = require('jsonwebtoken')
const crypto = require('crypto')

// JWT 密钥 (生产环境应从环境变量读取)
const JWT_SECRET = process.env.JWT_SECRET || 'lx-music-web-secret-key-change-in-production'
const JWT_EXPIRES_IN = '7d'

/**
 * 生成 JWT Token
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  )
}

/**
 * 验证 JWT Token
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch (error) {
    return null
  }
}

/**
 * 认证中间件
 */
function authMiddleware(req, res, next) {
  // 从请求头获取 token
  const authHeader = req.headers.authorization
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: '未提供认证令牌'
    })
  }
  
  const token = authHeader.substring(7)
  const decoded = verifyToken(token)
  
  if (!decoded) {
    return res.status(401).json({
      success: false,
      message: '无效的认证令牌'
    })
  }
  
  // 将用户信息附加到请求对象
  req.user = decoded
  next()
}

/**
 * 可选认证中间件 (有 token 则验证,没有则跳过)
 */
function optionalAuthMiddleware(req, res, next) {
  const authHeader = req.headers.authorization
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7)
    const decoded = verifyToken(token)
    
    if (decoded) {
      req.user = decoded
    }
  }
  
  next()
}

/**
 * 管理员权限中间件
 */
function adminMiddleware(req, res, next) {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: '需要登录'
    })
  }
  
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: '需要管理员权限'
    })
  }
  
  next()
}

/**
 * 密码加密
 */
function hashPassword(password, salt = null) {
  if (!salt) {
    salt = crypto.randomBytes(16).toString('hex')
  }
  
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex')
  
  return { hash, salt }
}

function verifyPassword(password, hash, salt) {
  const { hash: newHash } = hashPassword(password, salt)
  return hash === newHash
}

module.exports = {
  generateToken,
  verifyToken,
  authMiddleware,
  optionalAuthMiddleware,
  adminMiddleware,
  hashPassword,
  verifyPassword,
  JWT_SECRET
}
