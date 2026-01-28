/**
 * 自定义源执行引擎
 * 负责加载、执行和管理音乐源脚本
 * 
 * 核心功能:
 * 1. 在隔离沙盒中执行用户自定义源脚本
 * 2. 提供完整的 lx API 兼容层
 * 3. 管理多个音乐源的并存
 */

const { VM } = require('vm2')
const crypto = require('crypto')
const zlib = require('zlib')
const fetch = require('node-fetch')
const EventEmitter = require('events')

class SourceEngine extends EventEmitter {
  constructor(options = {}) {
    super()
    
    this.sources = new Map() // 存储已加载的源 { sourceId: { metadata, vm, apis } }
    this.requestCache = new Map() // 请求缓存
    this.options = {
      timeout: options.timeout || 10000,
      memoryLimit: options.memoryLimit || 128,
      enableCache: options.enableCache !== false,
      ...options
    }
  }

  /**
   * 加载自定义源脚本
   * @param {string} sourceId - 源的唯一标识符
   * @param {string} scriptCode - JavaScript 源代码
   * @returns {Promise<Object>} 源的元数据信息
   */
  async loadSource(sourceId, scriptCode) {
    try {
      // 1. 解析脚本元数据
      const metadata = this.parseMetadata(scriptCode)
      
      // 2. 创建沙盒虚拟机
      const vm = this.createSandbox()
      
      // 3. 在沙盒中执行脚本
      vm.run(scriptCode)
      
      // 4. 验证必要的导出方法
      this.validateSource(vm)
      
      // 5. 保存源信息
      this.sources.set(sourceId, {
        metadata,
        vm,
        enabled: true,
        loadedAt: Date.now()
      })
      
      this.emit('source:loaded', { sourceId, metadata })
      
      console.log(`[SourceEngine] 源加载成功: ${sourceId} (${metadata.name})`)
      
      return {
        success: true,
        sourceId,
        metadata
      }
    } catch (error) {
      console.error(`[SourceEngine] 源加载失败: ${sourceId}`, error)
      throw new Error(`源加载失败: ${error.message}`)
    }
  }

  /**
   * 创建沙盒环境
   * @returns {VM} vm2 虚拟机实例
   */
  createSandbox() {
    const vm = new VM({
      timeout: this.options.timeout,
      sandbox: {
        // 注入 lx API
        lx: {
          version: '2.0.0-web',
          env: 'server',
          
          // HTTP 请求方法
          request: this.createRequestProxy(),
          
          // 工具方法
          utils: this.createUtilsProxy(),
          
          // 事件系统
          on: (event, handler) => this.on(event, handler),
          send: (event, ...args) => this.emit(event, ...args)
        },
        
        // 全局对象
        console: {
          log: (...args) => console.log('[Source]', ...args),
          error: (...args) => console.error('[Source]', ...args),
          warn: (...args) => console.warn('[Source]', ...args)
        },
        
        // 定时器 (受限)
        setTimeout: (fn, delay) => setTimeout(fn, Math.min(delay, 5000)),
        setInterval: (fn, delay) => setInterval(fn, Math.max(delay, 1000)),
        
        // 用于存储全局状态
        globalThis: {}
      }
    })
    
    return vm
  }

  /**
   * 创建 HTTP 请求代理
   * 模拟 lx.request API
   */
  createRequestProxy() {
    return (url, options = {}, callback) => {
      // 支持 Promise 和 Callback 两种方式
      const promise = this.makeRequest(url, options)
      
      if (typeof callback === 'function') {
        promise
          .then(result => callback(null, result))
          .catch(error => callback(error))
      } else {
        return promise
      }
    }
  }

  /**
   * 执行 HTTP 请求
   */
  async makeRequest(url, options = {}) {
    const {
      method = 'GET',
      headers = {},
      body,
      form,
      formData,
      timeout = 10000,
      responseType = 'text' // text, json, buffer
    } = options

    // 缓存键
    const cacheKey = `${method}:${url}`
    
    // 检查缓存
    if (this.options.enableCache && method === 'GET' && this.requestCache.has(cacheKey)) {
      const cached = this.requestCache.get(cacheKey)
      if (Date.now() - cached.timestamp < 60000) { // 1分钟缓存
        return cached.data
      }
    }

    try {
      // 构造请求选项
      const fetchOptions = {
        method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          ...headers
        },
        timeout
      }

      // 处理请求体
      if (body) {
        fetchOptions.body = typeof body === 'string' ? body : JSON.stringify(body)
        if (!headers['Content-Type']) {
          fetchOptions.headers['Content-Type'] = 'application/json'
        }
      } else if (form) {
        const FormData = require('form-data')
        const formData = new FormData()
        for (const [key, value] of Object.entries(form)) {
          formData.append(key, value)
        }
        fetchOptions.body = formData
        fetchOptions.headers = { ...fetchOptions.headers, ...formData.getHeaders() }
      } else if (formData) {
        const params = new URLSearchParams()
        for (const [key, value] of Object.entries(formData)) {
          params.append(key, value)
        }
        fetchOptions.body = params.toString()
        fetchOptions.headers['Content-Type'] = 'application/x-www-form-urlencoded'
      }

      // 发送请求
      const response = await fetch(url, fetchOptions)
      
      // 处理响应
      let responseBody
      switch (responseType) {
        case 'json':
          responseBody = await response.json()
          break
        case 'buffer':
          responseBody = await response.buffer()
          break
        default:
          responseBody = await response.text()
      }

      const result = {
        statusCode: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody
      }

      // 写入缓存
      if (this.options.enableCache && method === 'GET') {
        this.requestCache.set(cacheKey, {
          data: result,
          timestamp: Date.now()
        })
      }

      return result
    } catch (error) {
      throw new Error(`请求失败: ${error.message}`)
    }
  }

  /**
   * 创建工具方法代理
   * 模拟 lx.utils API
   */
  createUtilsProxy() {
    return {
      // Buffer 操作
      buffer: {
        from: (data, encoding = 'utf8') => Buffer.from(data, encoding),
        toString: (buffer, encoding = 'utf8') => buffer.toString(encoding),
        bufToString: (buffer, encoding = 'utf8') => buffer.toString(encoding)
      },
      
      // 加密工具
      crypto: {
        // MD5
        md5: (data, encoding = 'hex') => {
          return crypto.createHash('md5').update(data).digest(encoding)
        },
        
        // SHA256
        sha256: (data, encoding = 'hex') => {
          return crypto.createHash('sha256').update(data).digest(encoding)
        },
        
        // AES 加密
        aesEncrypt: (data, mode, key, iv, options = {}) => {
          const algorithm = `aes-${mode.replace('aes-', '')}-${options.padding || 'cbc'}`
          const cipher = crypto.createCipheriv(algorithm, Buffer.from(key), Buffer.from(iv))
          return Buffer.concat([cipher.update(data), cipher.final()])
        },
        
        // AES 解密
        aesDecrypt: (data, mode, key, iv, options = {}) => {
          const algorithm = `aes-${mode.replace('aes-', '')}-${options.padding || 'cbc'}`
          const decipher = crypto.createDecipheriv(algorithm, Buffer.from(key), Buffer.from(iv))
          return Buffer.concat([decipher.update(data), decipher.final()])
        },
        
        // RSA 加密
        rsaEncrypt: (data, publicKey, options = {}) => {
          return crypto.publicEncrypt(
            {
              key: publicKey,
              padding: options.padding || crypto.constants.RSA_PKCS1_PADDING
            },
            Buffer.from(data)
          )
        },
        
        // 随机字节
        randomBytes: (size) => crypto.randomBytes(size),
        
        // Base64 编码
        base64Encode: (data) => Buffer.from(data).toString('base64'),
        
        // Base64 解码
        base64Decode: (data) => Buffer.from(data, 'base64').toString()
      },
      
      // 压缩工具
      zlib: {
        deflate: (data) => zlib.deflateSync(data),
        inflate: (data) => zlib.inflateSync(data),
        gzip: (data) => zlib.gzipSync(data),
        gunzip: (data) => zlib.gunzipSync(data)
      },
      
      // 字符串工具
      string: {
        trim: (str) => str.trim(),
        split: (str, separator) => str.split(separator),
        replace: (str, search, replacement) => str.replace(search, replacement),
        match: (str, regex) => str.match(regex)
      }
    }
  }

  /**
   * 解析脚本元数据
   * 从注释中提取 @name, @version 等信息
   */
  parseMetadata(scriptCode) {
    const metadata = {
      name: 'Unknown Source',
      version: '1.0.0',
      author: 'Unknown',
      description: '',
      homepage: ''
    }

    const lines = scriptCode.split('\n').slice(0, 20) // 只检查前20行
    
    for (const line of lines) {
      const match = line.match(/@(\w+)\s+(.+)/)
      if (match) {
        const [, key, value] = match
        metadata[key] = value.trim()
      }
    }

    return metadata
  }

  /**
   * 验证源是否实现了必要的方法
   */
  validateSource(vm) {
    const requiredMethods = ['search', 'getUrl']
    const globalThis = vm.run('globalThis')
    
    for (const method of requiredMethods) {
      if (typeof globalThis[method] !== 'function') {
        throw new Error(`源必须实现 ${method} 方法`)
      }
    }
  }

  /**
   * 调用源的方法
   * @param {string} sourceId - 源ID
   * @param {string} method - 方法名
   * @param {*} params - 参数
   */
  async callMethod(sourceId, method, params) {
    const source = this.sources.get(sourceId)
    
    if (!source) {
      throw new Error(`源不存在: ${sourceId}`)
    }
    
    if (!source.enabled) {
      throw new Error(`源已禁用: ${sourceId}`)
    }

    try {
      // 在沙盒中调用方法
      const code = `
        (async () => {
          const handler = globalThis['${method}']
          if (typeof handler !== 'function') {
            throw new Error('方法未定义: ${method}')
          }
          return await handler(${JSON.stringify(params)})
        })()
      `
      
      const result = await source.vm.run(code)
      return result
    } catch (error) {
      console.error(`[SourceEngine] 调用方法失败: ${sourceId}.${method}`, error)
      throw new Error(`调用方法失败: ${error.message}`)
    }
  }

  /**
   * 搜索音乐
   */
  async search(sourceId, keyword, page = 1, limit = 30) {
    return await this.callMethod(sourceId, 'search', {
      keyword,
      page,
      limit
    })
  }

  /**
   * 获取音乐播放地址
   */
  async getMusicUrl(sourceId, songInfo, quality = '128k') {
    return await this.callMethod(sourceId, 'getUrl', {
      songInfo,
      quality
    })
  }

  /**
   * 获取歌词
   */
  async getLyric(sourceId, songInfo) {
    return await this.callMethod(sourceId, 'getLyric', {
      songInfo
    })
  }

  /**
   * 获取歌单列表
   */
  async getSonglist(sourceId, tag, page = 1) {
    return await this.callMethod(sourceId, 'getSonglist', {
      tag,
      page
    })
  }

  /**
   * 获取榜单
   */
  async getLeaderboard(sourceId) {
    return await this.callMethod(sourceId, 'getLeaderboard', {})
  }

  /**
   * 卸载源
   */
  unloadSource(sourceId) {
    const source = this.sources.get(sourceId)
    if (source) {
      this.sources.delete(sourceId)
      this.emit('source:unloaded', { sourceId })
      console.log(`[SourceEngine] 源已卸载: ${sourceId}`)
    }
  }

  /**
   * 启用/禁用源
   */
  toggleSource(sourceId, enabled) {
    const source = this.sources.get(sourceId)
    if (source) {
      source.enabled = enabled
      this.emit('source:toggled', { sourceId, enabled })
    }
  }

  /**
   * 获取所有已加载的源
   */
  getSources() {
    const sources = []
    for (const [id, source] of this.sources.entries()) {
      sources.push({
        id,
        ...source.metadata,
        enabled: source.enabled,
        loadedAt: source.loadedAt
      })
    }
    return sources
  }

  /**
   * 清理缓存
   */
  clearCache() {
    this.requestCache.clear()
    console.log('[SourceEngine] 缓存已清理')
  }
}

module.exports = SourceEngine
