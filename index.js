/**
 * API 封装
 * 统一处理所有后端 API 请求
 */

import axios from 'axios'
import { ElMessage } from 'element-plus'

// 创建 axios 实例
const request = axios.create({
  baseURL: '/api',
  timeout: 30000
})

// 请求拦截器
request.interceptors.request.use(
  config => {
    return config
  },
  error => {
    console.error('请求错误:', error)
    return Promise.reject(error)
  }
)

// 响应拦截器
request.interceptors.response.use(
  response => {
    const res = response.data
    
    // 如果请求成功
    if (res.success !== false) {
      return res
    } else {
      ElMessage.error(res.message || '请求失败')
      return Promise.reject(new Error(res.message || '请求失败'))
    }
  },
  error => {
    console.error('响应错误:', error)
    ElMessage.error(error.message || '网络错误')
    return Promise.reject(error)
  }
)

// 音乐相关 API
export const musicApi = {
  // 搜索音乐
  search(params) {
    return request.post('/music/search', params)
  },
  
  // 获取播放链接
  getMusicUrl(params) {
    return request.post('/music/url', params)
  },
  
  // 获取歌词
  getLyric(params) {
    return request.post('/music/lyric', params)
  },
  
  // 获取榜单
  getLeaderboard(source) {
    return request.get(`/music/leaderboard/${source}`)
  },
  
  // 获取歌单详情
  getSonglist(source, id) {
    return request.get(`/music/songlist/${source}/${id}`)
  }
}

// 下载相关 API
export const downloadApi = {
  // 添加下载任务
  add(params) {
    return request.post('/download/add', params)
  },
  
  // 获取下载列表
  getList(params = {}) {
    return request.get('/download/list', { params })
  },
  
  // 暂停下载
  pause(taskId) {
    return request.post('/download/pause', { taskId })
  },
  
  // 恢复下载
  resume(taskId) {
    return request.post('/download/resume', { taskId })
  },
  
  // 删除任务
  delete(taskId) {
    return request.delete(`/download/${taskId}`)
  },
  
  // 获取统计
  getStats() {
    return request.get('/download/stats')
  }
}

// 音源相关 API
export const sourceApi = {
  // 获取音源列表
  getList() {
    return request.get('/source/list')
  },
  
  // 上传音源
  upload(file) {
    const formData = new FormData()
    formData.append('source', file)
    return request.post('/source/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
  },
  
  // 删除音源
  delete(sourceId) {
    return request.delete(`/source/${sourceId}`)
  },
  
  // 切换音源状态
  toggle(sourceId, enabled) {
    return request.post('/source/toggle', { sourceId, enabled })
  },
  
  // 导出音源
  export(sourceId) {
    return `/api/source/export/${sourceId}`
  }
}

export default {
  music: musicApi,
  download: downloadApi,
  source: sourceApi
}
