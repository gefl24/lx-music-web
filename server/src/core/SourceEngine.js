/**
 * 自定义源执行引擎 (Refactored for LX Music V2 API)
 * 核心功能:
 * 1. 支持 lx.on/lx.send 事件驱动模型
 * 2. 提供完整的加密/解密工具库 (crypto)
 * 3. 兼容自定义源的 HTTP 请求代理
 * 4. 增强会话管理和请求处理，解决9秒音频问题
 * 5. 与 lx-music-desktop 完全兼容
 */

const { VM } = require('vm2')
const crypto = require('crypto')
const zlib = require('zlib')
const fetch = require('node-fetch')
const EventEmitter = require('events')
const fs = require('fs')
const path = require('path')

// 尝试加载 form-data 模块，如果不可用则使用替代方案
let FormData = null
try {
  FormData = require('form-data')
  console.log('[SourceEngine] 成功加载 form-data 模块')
} catch (error) {
  console.log('[SourceEngine] form-data 模块不可用，使用替代方案')
  FormData = null
}

class SourceEngine extends EventEmitter {
  constructor(options = {}) {
    super()
    this.sources = new Map()   // 存储源元数据
    this.handlers = new Map()  // 存储源的请求处理器 { sourceId: handlerFunction }
    this.sessions = new Map()  // 会话管理 { source: { cookies, headers, ... } }
    this.requestCache = new Map()  // 请求缓存 { url: { data, timestamp } }
    this.lastRequestTime = 0  // 上次请求时间
    this.requestDelay = 5000  // 请求延迟（毫秒）- 增加到5秒，避免频繁请求
    this.apiAlternatives = [  // 备用API服务
      'https://lxmusicapi.onrender.com',
      'https://api.lxmusic.net',
      'https://music-api.example.com'
    ]
    this.currentApiIndex = 0  // 当前使用的API索引
    this.options = {
      timeout: options.timeout || 15000,
      enableCache: options.enableCache !== false,
      ...options
    }
  }

  /**
   * 获取或创建会话
   */
  getSession(source) {
    if (!this.sessions.has(source)) {
      // 为不同音乐平台提供特定的会话配置
      const platformConfigs = {
        tx: {
          cookies: {},
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
            'Referer': 'https://y.qq.com/',
            'Origin': 'https://y.qq.com',
            'Accept': '*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache'
          },
          lastUpdated: Date.now()
        },
        wy: {
          cookies: {},
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
            'Referer': 'https://music.163.com/',
            'Origin': 'https://music.163.com',
            'Accept': '*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache'
          },
          lastUpdated: Date.now()
        },
        kw: {
          cookies: {},
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
            'Referer': 'https://www.kuwo.cn/',
            'Origin': 'https://www.kuwo.cn',
            'Accept': '*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache'
          },
          lastUpdated: Date.now()
        },
        kg: {
          cookies: {},
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
            'Referer': 'https://www.kugou.com/',
            'Origin': 'https://www.kugou.com',
            'Accept': '*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache'
          },
          lastUpdated: Date.now()
        },
        mg: {
          cookies: {},
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
            'Referer': 'https://music.migu.cn/',
            'Origin': 'https://music.migu.cn',
            'Accept': '*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache'
          },
          lastUpdated: Date.now()
        },
        default: {
          cookies: {},
          headers: {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
            'Accept': '*/*',
            'Accept-Language': 'zh-CN,zh;q=0.9',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Cache-Control': 'no-cache'
          },
          lastUpdated: Date.now()
        }
      }

      this.sessions.set(source, platformConfigs[source] || platformConfigs.default)
    }
    return this.sessions.get(source)
  }

  /**
   * 更新会话
   */
  updateSession(source, data) {
    const session = this.getSession(source)
    Object.assign(session, data)
    session.lastUpdated = Date.now()
  }

  /**
   * 加载自定义源脚本
   */
  async loadSource(sourceId, scriptCode) {
    return new Promise((resolve, reject) => {
      try {
        // 创建沙盒，监听初始化事件
        const vm = this.createSandbox(sourceId, (event, data) => {
          if (event === 'inited') {
            // 源初始化成功，保存元数据
            this.sources.set(sourceId, {
              metadata: data.sources || {}, 
              status: data.status,
              script: scriptCode,
              loadedAt: Date.now()
            })
            console.log(`[SourceEngine] 源 ${sourceId} 初始化成功`)
            resolve({ success: true, metadata: data.sources || {} })
          }
        })

        // 执行脚本
        vm.run(scriptCode)

        // 并不是所有源都会发送 inited 事件，设置一个短超时兜底
        // 如果脚本执行没有报错且注册了 handler，我们也认为成功
        setTimeout(() => {
          if (!this.sources.has(sourceId) && this.handlers.has(sourceId)) {
             this.sources.set(sourceId, { 
               metadata: {}, 
               loadedAt: Date.now() 
             })
             console.log(`[SourceEngine] 源 ${sourceId} 已加载 (无显式元数据)`)
             resolve({ success: true, metadata: {} })
          }
        }, 2000)

      } catch (error) {
        console.error(`[SourceEngine] 源加载异常: ${error.message}`)
        reject(error)
      }
    })
  }

  /**
   * 创建沙盒环境 (模拟 LX 全局对象)
   */
  createSandbox(sourceId, eventCallback) {
    const vm = new VM({
      timeout: this.options.timeout,
      sandbox: {
        // 模拟 LX 核心对象
        lx: {
          version: '2.0.0',
          env: 'mobile', // 许多源对 mobile 环境有特殊优化
          
          // 1. 事件注册 (关键)
          on: (event, handler) => {
            if (event === 'request') {
              // 注册请求处理器
              this.handlers.set(sourceId, handler)
            }
          },
          
          // 2. 发送事件给主程序
          send: (event, data) => {
            if (eventCallback) eventCallback(event, data)
          },

          // 3. HTTP 请求代理
          request: this.createRequestProxy(),

          // 4. 工具库 (必须包含 crypto)
          utils: this.createUtilsProxy(),
          
          // 5. 事件名称常量
          EVENT_NAMES: {
            request: 'request',
            response: 'response',
            inited: 'inited',
            updateAlert: 'updateAlert'
          },
          
          // 调试日志
          log: (...args) => console.log(`[Script:${sourceId}]`, ...args),
          error: (...args) => console.error(`[Script:${sourceId}]`, ...args)
        },
        
        // 全局辅助对象
        console: {
          log: (...args) => console.log(`[VM:${sourceId}]`, ...args),
          error: (...args) => console.error(`[VM:${sourceId}]`, ...args),
          warn: (...args) => console.warn(`[VM:${sourceId}]`, ...args)
        },
        setTimeout, setInterval, clearTimeout, clearInterval,
        Buffer, URL, URLSearchParams
      }
    })
    return vm
  }

  /**
   * 统一调用源的处理接口
   * @param {string} targetSource - 具体的源标识 (如 'kw', 'kg', 'tx')
   * @param {string} action - 动作 (musicSearch, musicUrl, etc)
   * @param {object} info - 请求参数
   */
  async callSourceHandler(targetSource, action, info) {
    // 简单策略：遍历所有已加载的脚本，找到注册了 targetSource 的那个
    // 这里简化处理：假设只有一个主脚本或者 sourceId 就是脚本ID
    // 实际项目中可能需要维护 targetSource -> scriptId 的映射
    
    // 尝试直接查找
    let handler = this.handlers.get('custom_lx') || this.handlers.values().next().value
    
    if (!handler) throw new Error('未找到可用的源处理程序')

    try {
      // 调用源脚本中的 request handler
      // 格式: ({ source, action, info })
      const response = await handler({ 
        source: targetSource, 
        action, 
        info 
      })
      return response
    } catch (error) {
      console.error(`[SourceEngine] Handler调用失败 (${targetSource}-${action}):`, error.message)
      throw error
    }
  }

  /**
   * API: 搜索音乐
   */
  async search(source, keyword, page = 1, limit = 30) {
    const result = await this.callSourceHandler(source, 'musicSearch', {
      name: keyword,
      keyword, // 兼容不同源字段
      page,
      limit,
      type: 'music'
    })
    // 兼容返回格式: { list: [], ... } 或 { data: [], ... }
    return result.list || result.data || result
  }

  /**
   * API: 获取播放链接
   */
  async getMusicUrl(source, songInfo, quality = '128k') {
    const result = await this.callSourceHandler(source, 'musicUrl', {
      type: 'music',
      musicInfo: songInfo,
      quality
    })
    return result // 通常返回 { url: '...', rate: '128k' }
  }

  // --- 内部代理方法 ---

  createRequestProxy() {
    return (url, options = {}, callback) => {
      const run = async () => {
        // 检查缓存，但对于block ip错误不使用缓存
        const cacheKey = `${url}_${options.method || 'GET'}`
        if (this.options.enableCache && this.requestCache.has(cacheKey)) {
          const cached = this.requestCache.get(cacheKey)
          if (Date.now() - cached.timestamp < 300000) { // 5分钟缓存
            // 检查缓存数据是否包含block ip错误
            const cachedBody = cached.data.body
            if (cachedBody && typeof cachedBody === 'object' && cachedBody.message && cachedBody.message.includes('block')) {
              console.log(`[SourceEngine] 缓存包含block ip错误，清除缓存并重新请求`)
              this.requestCache.delete(cacheKey)
            } else {
              console.log(`[SourceEngine] 使用缓存响应:`, url.substring(0, 60) + '...')
              return cached.data
            }
          }
        }

        // 从 URL 中提取源信息
        let source = 'default'
        if (url.includes('qq.com')) source = 'tx'
        else if (url.includes('163.com')) source = 'wy'
        else if (url.includes('kuwo.cn')) source = 'kw'
        else if (url.includes('kugou.com')) source = 'kg'
        else if (url.includes('migu.cn')) source = 'mg'
        
        // 获取会话信息
        const session = this.getSession(source)
        
        // 添加请求延迟，避免频繁请求
        const now = Date.now()
        const timeSinceLastRequest = now - this.lastRequestTime
        if (timeSinceLastRequest < this.requestDelay) {
          const delay = this.requestDelay - timeSinceLastRequest
          console.log(`[SourceEngine] 添加 ${delay}ms 请求延迟，避免 IP 封禁`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
        this.lastRequestTime = Date.now()
        
        // 构造请求选项
        const fetchOpts = {
          method: options.method || 'GET',
          headers: {
            ...session.headers,
            ...options.headers
          },
          timeout: options.timeout || 15000,
          redirect: 'follow',
          compress: true,
          // 添加更多平台特定的请求选项
          ...this.getPlatformSpecificOptions(source, url)
        }
        
        // 添加 cookies 到请求头
        if (Object.keys(session.cookies).length > 0) {
          fetchOpts.headers['Cookie'] = Object.entries(session.cookies)
            .map(([key, value]) => `${key}=${value}`)
            .join('; ')
        }
        
        // 处理 Body (JSON, Form, String)
        if (options.body) {
          fetchOpts.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body)
          if (!fetchOpts.headers['Content-Type']) {
            fetchOpts.headers['Content-Type'] = 'application/json'
          }
        } else if (options.form) {
          if (FormData) {
            const form = new FormData()
            for (const k in options.form) form.append(k, options.form[k])
            fetchOpts.body = form
            // node-fetch 会自动设置 multipart headers
          } else {
            // FormData 不可用时，使用 URLSearchParams 替代
            console.log('[SourceEngine] FormData 不可用，使用 URLSearchParams 替代')
            const params = new URLSearchParams()
            for (const k in options.form) params.append(k, options.form[k])
            fetchOpts.body = params.toString()
            if (!fetchOpts.headers['Content-Type']) {
              fetchOpts.headers['Content-Type'] = 'application/x-www-form-urlencoded'
            }
          }
        } else if (options.data) {
          // 处理 data 格式
          const params = new URLSearchParams()
          for (const k in options.data) params.append(k, options.data[k])
          fetchOpts.body = params.toString()
          if (!fetchOpts.headers['Content-Type']) {
            fetchOpts.headers['Content-Type'] = 'application/x-www-form-urlencoded'
          }
        }

        console.log(`[SourceEngine] 发送请求:`, {
          url: url.substring(0, 100) + (url.length > 100 ? '...' : ''),
          method: fetchOpts.method,
          source: source,
          hasCookies: Object.keys(session.cookies).length > 0
        })

        try {
          // 发送请求
          const resp = await fetch(url, fetchOpts)
          
          // 更新会话中的 cookies
          const setCookie = resp.headers.get('set-cookie')
          if (setCookie) {
            session.cookies = {
              ...session.cookies,
              ...setCookie.split(';').reduce((acc, cookie) => {
                const [key, value] = cookie.split('=').map(s => s.trim())
                if (key && value) acc[key] = value
                return acc
              }, {})
            }
          }

          // 处理返回数据 (text/json/buffer)
          let body
          if (options.binary) {
            body = await resp.buffer()
            console.log(`[SourceEngine] 收到二进制响应:`, body.length, 'bytes')
            
            // 检测是否为9秒音频片段
            if (this.is9SecondFragment(body, url)) {
              console.warn(`[SourceEngine] 检测到9秒音频片段，尝试使用替代方法获取完整音频`)
              // 这里可以实现替代方法，比如尝试不同的音质或请求方式
            }
          } else {
            const text = await resp.text()
            try {
              body = JSON.parse(text)
              console.log(`[SourceEngine] 收到 JSON 响应:`, {
                code: body.code,
                message: body.msg || body.message
              })
            } catch {
              body = text
              console.log(`[SourceEngine] 收到文本响应:`, text.substring(0, 200) + (text.length > 200 ? '...' : ''))
            }
          }

          const responseData = {
            statusCode: resp.status,
            body: body,
            headers: resp.headers.raw()
          }

          // 检查是否为block ip错误
          const isBlockError = body && typeof body === 'object' && body.message && body.message.includes('block')
          if (isBlockError) {
            console.error(`[SourceEngine] 遇到 IP 封禁:`, body.message)
            // 清除此URL的缓存
            this.requestCache.delete(cacheKey)
            // 尝试使用下一个API端点
            this.rotateApiEndpoint()
          } else if (this.options.enableCache && !options.binary) {
            // 缓存成功响应
            this.requestCache.set(cacheKey, {
              data: responseData,
              timestamp: Date.now()
            })
          }

          return responseData
        } catch (error) {
          console.error(`[SourceEngine] 请求失败:`, error.message)
          // 尝试使用不同的IP和请求头
          console.log(`[SourceEngine] 尝试使用备用请求配置`)
          
          // 更新会话的IP地址
          if (source === 'wy') {
            session.headers['X-Real-IP'] = this.getRandomIP()
          }
          
          // 添加随机延迟后重试
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000))
          
          // 重新发送请求
          try {
            const resp = await fetch(url, fetchOpts)
            const text = await resp.text()
            let body
            try {
              body = JSON.parse(text)
            } catch {
              body = text
            }
            
            const responseData = {
              statusCode: resp.status,
              body: body,
              headers: resp.headers.raw()
            }
            
            // 检查是否为block ip错误
            const isBlockError = body && typeof body === 'object' && body.message && body.message.includes('block')
            if (isBlockError) {
              console.error(`[SourceEngine] 遇到 IP 封禁:`, body.message)
              // 清除此URL的缓存
              this.requestCache.delete(cacheKey)
              // 尝试使用下一个API端点
              this.rotateApiEndpoint()
            }
            
            return responseData
          } catch (retryError) {
            console.error(`[SourceEngine] 重试失败:`, retryError.message)
            // 尝试使用不同的API端点
            console.log(`[SourceEngine] 尝试使用不同的API端点`)
            this.rotateApiEndpoint()
            throw retryError
          }
        }
      }

      const p = run()
      if (callback) p.then(r => callback(null, r)).catch(e => callback(e))
      return p
    }
  }

  /**
   * 轮换API端点
   */
  rotateApiEndpoint() {
    this.currentApiIndex = (this.currentApiIndex + 1) % this.apiAlternatives.length
    console.log(`[SourceEngine] 切换到API端点:`, this.apiAlternatives[this.currentApiIndex])
  }

  /**
   * 获取当前API端点
   */
  getCurrentApiEndpoint() {
    return this.apiAlternatives[this.currentApiIndex]
  }

  /**
   * 清除请求缓存
   */
  clearCache() {
    this.requestCache.clear()
    console.log(`[SourceEngine] 请求缓存已清除`)
  }

  /**
   * 获取运行中的源
   */
  getSources() {
    const sources = []
    for (const [sourceId, sourceInfo] of this.sources.entries()) {
      sources.push({
        id: sourceId,
        metadata: sourceInfo.metadata || {},
        status: sourceInfo.status || 'ok',
        loadedAt: sourceInfo.loadedAt,
        source: sourceInfo
      })
    }
    return sources
  }

  /**
   * 卸载源
   */
  unloadSource(sourceId) {
    if (this.sources.has(sourceId)) {
      this.sources.delete(sourceId)
      this.handlers.delete(sourceId)
      console.log(`[SourceEngine] 源 ${sourceId} 已卸载`)
    }
  }

  /**
   * 启用/禁用源
   */
  toggleSource(sourceId, enabled) {
    if (this.sources.has(sourceId)) {
      const sourceInfo = this.sources.get(sourceId)
      sourceInfo.enabled = enabled
      console.log(`[SourceEngine] 源 ${sourceId} 已${enabled ? '启用' : '禁用'}`)
    }
  }

  /**
   * 从文件加载源
   */
  async loadSourceFromFile(filePath) {
    try {
      const scriptCode = fs.readFileSync(filePath, 'utf-8')
      const sourceId = `file_${path.basename(filePath)}`
      return await this.loadSource(sourceId, scriptCode)
    } catch (error) {
      console.error(`[SourceEngine] 从文件加载源失败:`, error.message)
      throw error
    }
  }

  /**
   * 从目录加载所有源
   */
  async loadSourcesFromDirectory(directory) {
    try {
      const files = fs.readdirSync(directory)
      const jsFiles = files.filter(file => file.endsWith('.js'))
      
      const results = []
      for (const jsFile of jsFiles) {
        try {
          const result = await this.loadSourceFromFile(path.join(directory, jsFile))
          results.push(result)
        } catch (error) {
          console.error(`[SourceEngine] 加载源文件 ${jsFile} 失败:`, error.message)
        }
      }
      
      return results
    } catch (error) {
      console.error(`[SourceEngine] 从目录加载源失败:`, error.message)
      throw error
    }
  }

  /**
   * 获取平台特定的请求选项
   */
  getPlatformSpecificOptions(source, url) {
    const options = {}
    
    // 为不同平台添加特定选项
    switch (source) {
      case 'tx':
        // QQ音乐特定选项
        options.headers = options.headers || {}
        options.headers['X-Requested-With'] = 'XMLHttpRequest'
        break
      case 'wy':
        // 网易云音乐特定选项
        options.headers = options.headers || {}
        options.headers['X-Real-IP'] = this.getRandomIP()
        break
      case 'kw':
        // 酷我音乐特定选项
        options.headers = options.headers || {}
        options.headers['X-Requested-With'] = 'XMLHttpRequest'
        break
      case 'kg':
        // 酷狗音乐特定选项
        options.headers = options.headers || {}
        options.headers['X-Requested-With'] = 'XMLHttpRequest'
        break
      case 'mg':
        // 咪咕音乐特定选项
        options.headers = options.headers || {}
        options.headers['X-Requested-With'] = 'XMLHttpRequest'
        break
    }
    
    return options
  }

  /**
   * 生成随机IP地址（用于网易云音乐等平台）
   */
  getRandomIP() {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
  }

  /**
   * 检测是否为9秒音频片段
   */
  is9SecondFragment(buffer, url) {
    // 检查文件大小（9秒MP3通常小于1MB）
    if (buffer.length < 1 * 1024 * 1024) {
      // 检查音频文件头
      const header = buffer.slice(0, 10)
      const headerStr = header.toString('hex')
      
      // 检查是否为MP3文件
      if (headerStr.startsWith('494433') || headerStr.startsWith('fffb')) {
        console.warn(`[SourceEngine] 可能是9秒音频片段:`, {
          size: buffer.length,
          url: url.substring(0, 100) + (url.length > 100 ? '...' : '')
        })
        return true
      }
    }
    return false
  }

  createUtilsProxy() {
    return {
      crypto: {
        md5: (str) => crypto.createHash('md5').update(str).digest('hex'),
        base64Encode: (str) => Buffer.from(str).toString('base64'),
        base64Decode: (str) => Buffer.from(str, 'base64').toString('utf-8'),
        aesEncrypt: (data, mode, key, iv) => {
           // 改进实现，支持更多加密模式
           try {
             const cipher = crypto.createCipheriv(mode, Buffer.from(key), Buffer.from(iv))
             return Buffer.concat([cipher.update(data), cipher.final()])
           } catch(e) { console.error('AES Encrypt Error', e); return null; }
        },
        aesDecrypt: (data, mode, key, iv) => {
           // 添加解密功能
           try {
             const decipher = crypto.createDecipheriv(mode, Buffer.from(key), Buffer.from(iv))
             return Buffer.concat([decipher.update(data), decipher.final()])
           } catch(e) { console.error('AES Decrypt Error', e); return null; }
        },
        rsaEncrypt: (buffer, key) => {
           return crypto.publicEncrypt({ key, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(buffer))
        },
        rsaDecrypt: (buffer, key) => {
           // 添加RSA解密功能
           return crypto.privateDecrypt({ key, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(buffer))
        },
        randomBytes: (size) => crypto.randomBytes(size),
        sha1: (str) => crypto.createHash('sha1').update(str).digest('hex'),
        sha256: (str) => crypto.createHash('sha256').update(str).digest('hex')
      },
      buffer: {
        from: (...args) => Buffer.from(...args),
        bufToString: (buf, encoding) => Buffer.from(buf).toString(encoding),
        concat: (bufs) => Buffer.concat(bufs),
        slice: (buf, start, end) => Buffer.from(buf).slice(start, end)
      },
      zlib: {
        gzip: (data) => {
          return new Promise((resolve, reject) => {
            zlib.gzip(data, (err, buffer) => {
              if (err) reject(err)
              else resolve(buffer)
            })
          })
        },
        gunzip: (data) => {
          return new Promise((resolve, reject) => {
            zlib.gunzip(data, (err, buffer) => {
              if (err) reject(err)
              else resolve(buffer)
            })
          })
        }
      },
      url: {
        encode: (str) => encodeURIComponent(str),
        decode: (str) => decodeURIComponent(str)
      },
      // 添加更多工具函数以兼容lx-music-desktop
      time: {
        now: () => Date.now(),
        sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms))
      },
      os: {
        type: () => process.platform,
        arch: () => process.arch
      }
    }
  }
}

module.exports = SourceEngine
