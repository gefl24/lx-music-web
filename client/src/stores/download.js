/**
 * 下载管理状态
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { downloadApi } from '@/api'
import { io } from 'socket.io-client'
import { ElMessage } from 'element-plus'

export const useDownloadStore = defineStore('download', () => {
  // 状态
  const tasks = ref([])
  const socket = ref(null)
  const stats = ref({ queue: 0, active: 0, stats: [] })
  
  // 初始化 WebSocket
  function initSocket() {
    if (!socket.value) {
      socket.value = io('http://localhost:3000')
      
      // 监听连接
      socket.value.on('connected', (data) => {
        console.log('WebSocket 已连接:', data.socketId)
      })
      
      // 监听下载进度
      socket.value.on('download:progress', (data) => {
        const task = tasks.value.find(t => t.id === data.taskId)
        if (task) {
          task.progress = data.progress
          task.downloadedSize = data.downloadedSize
          task.totalSize = data.totalSize
          task.speed = data.speed
        }
      })
      
      // 监听下载完成
      socket.value.on('download:completed', (data) => {
        const task = tasks.value.find(t => t.id === data.taskId)
        if (task) {
          task.status = 'completed'
          task.filepath = data.filepath
          task.progress = 100
        }
        ElMessage.success(`《${data.songName}》下载完成`)
      })
      
      // 监听下载失败
      socket.value.on('download:failed', (data) => {
        const task = tasks.value.find(t => t.id === data.taskId)
        if (task) {
          task.status = 'failed'
          task.error = data.error
        }
        ElMessage.error(`《${data.songName}》下载失败`)
      })
    }
  }
  
  // 加载任务列表
  async function loadTasks(status = null) {
    try {
      const res = await downloadApi.getList({ status })
      tasks.value = res.data.tasks
    } catch (error) {
      console.error('加载任务列表失败:', error)
    }
  }
  
  // 添加下载任务
  async function addDownload(songInfo, quality, source) {
    try {
      const res = await downloadApi.add({
        songInfo,
        quality,
        source
      })
      
      if (res.data.status === 'exists') {
        ElMessage.info('文件已存在')
      } else if (res.data.status === 'queued') {
        ElMessage.info('任务已在队列中')
      } else {
        // 添加到本地列表
        tasks.value.unshift({
          id: res.data.taskId,
          song_name: songInfo.name,
          artist: songInfo.singer,
          quality,
          status: 'pending',
          progress: 0,
          created_at: Date.now()
        })
        
        ElMessage.success('已添加到下载队列')
      }
      
      // 刷新统计
      await loadStats()
      
      return res.data.taskId
    } catch (error) {
      ElMessage.error('添加下载失败: ' + error.message)
      throw error
    }
  }
  
  // 暂停下载
  async function pauseTask(taskId) {
    try {
      await downloadApi.pause(taskId)
      const task = tasks.value.find(t => t.id === taskId)
      if (task) {
        task.status = 'paused'
      }
      ElMessage.success('已暂停')
    } catch (error) {
      ElMessage.error('暂停失败')
    }
  }
  
  // 恢复下载
  async function resumeTask(taskId) {
    try {
      await downloadApi.resume(taskId)
      const task = tasks.value.find(t => t.id === taskId)
      if (task) {
        task.status = 'pending'
      }
      ElMessage.success('已恢复')
    } catch (error) {
      ElMessage.error('恢复失败')
    }
  }
  
  // 删除任务
  async function deleteTask(taskId) {
    try {
      await downloadApi.delete(taskId)
      const index = tasks.value.findIndex(t => t.id === taskId)
      if (index !== -1) {
        tasks.value.splice(index, 1)
      }
      ElMessage.success('已删除')
    } catch (error) {
      ElMessage.error('删除失败')
    }
  }
  
  // 加载统计
  async function loadStats() {
    try {
      const res = await downloadApi.getStats()
      stats.value = res.data
    } catch (error) {
      console.error('加载统计失败:', error)
    }
  }
  
  // 格式化文件大小
  function formatSize(bytes) {
    if (!bytes) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }
  
  // 格式化速度
  function formatSpeed(bytesPerSecond) {
    return formatSize(bytesPerSecond) + '/s'
  }
  
  return {
    // 状态
    tasks,
    stats,
    
    // 方法
    initSocket,
    loadTasks,
    addDownload,
    pauseTask,
    resumeTask,
    deleteTask,
    loadStats,
    formatSize,
    formatSpeed
  }
})
