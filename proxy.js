/**
 * 音频代理路由
 * 解决音乐平台的防盗链问题
 * 
 * 端点:
 * - GET /api/proxy/stream - 代理音频流
 */

const express = require('express')
const fetch = require('node-fetch')
const router = express.Router()

/**
 * 音频流代理
 * GET /api/proxy/stream?url=xxx&source=kw
 */
router.get('/stream', async (req, res) => {
  const { url, source } = req.query

  if (!url) {
    return res.status(400).send('Missing URL parameter')
  }

  try {
    const decodedUrl = decodeURIComponent(url)
    
    console.log(`[Proxy] 代理音频流: ${decodedUrl.substring(0, 100)}...`)

    // 根据音源设置请求头
    const headers = getHeadersForSource(source)
    
    // 支持 Range 请求（断点续传）
    if (req.headers.range) {
      headers['Range'] = req.headers.range
    }

    // 发送请求
    const response = await fetch(decodedUrl, {
      headers,
      timeout: 30000
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    // 设置响应头
    const contentType = response.headers.get('content-type') || 'audio/mpeg'
    const contentLength = response.headers.get('content-length')
    const acceptRanges = response.headers.get('accept-ranges')
    
    res.setHeader('Content-Type', contentType)
    res.setHeader('Accept-Ranges', acceptRanges || 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    
    if (contentLength) {
      res.setHeader('Content-Length', contentLength)
    }

    // 如果是 Range 请求，返回 206
    if (response.status === 206) {
      res.status(206)
      const contentRange = response.headers.get('content-range')
      if (contentRange) {
        res.setHeader('Content-Range', contentRange)
      }
    }

    // 流式传输音频
    response.body.pipe(res)

    // 错误处理
    response.body.on('error', (error) => {
      console.error('[Proxy] Stream error:', error)
      if (!res.headersSent) {
        res.status(500).send('Stream error')
      }
    })

    req.on('close', () => {
      response.body.destroy()
    })
  } catch (error) {
    console.error('[Proxy] Proxy error:', error)
    
    if (!res.headersSent) {
      res.status(500).send(error.message)
    }
  }
})

/**
 * 根据音源类型获取请求头
 */
function getHeadersForSource(source) {
  const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  }

  const sourceHeaders = {
    kw: {
      ...baseHeaders,
      'Referer': 'https://www.kuwo.cn/',
      'Origin': 'https://www.kuwo.cn'
    },
    kg: {
      ...baseHeaders,
      'Referer': 'https://www.kugou.com/',
      'Origin': 'https://www.kugou.com'
    },
    tx: {
      ...baseHeaders,
      'Referer': 'https://y.qq.com/',
      'Origin': 'https://y.qq.com'
    },
    wy: {
      ...baseHeaders,
      'Referer': 'https://music.163.com/',
      'Origin': 'https://music.163.com'
    },
    mg: {
      ...baseHeaders,
      'Referer': 'https://music.migu.cn/',
      'Origin': 'https://music.migu.cn'
    }
  }

  return sourceHeaders[source] || baseHeaders
}

module.exports = router
