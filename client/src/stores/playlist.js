/**
 * 歌单管理状态
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

export const usePlaylistStore = defineStore('playlist', () => {
  // 状态
  const playlists = ref([])
  const currentPlaylist = ref(null)
  
  // 加载歌单列表
  async function loadPlaylists() {
    try {
      const res = await axios.get('/api/playlist/list')
      playlists.value = res.data.data
    } catch (error) {
      console.error('加载歌单列表失败:', error)
    }
  }
  
  // 创建歌单
  async function createPlaylist(data) {
    try {
      const res = await axios.post('/api/playlist/create', data)
      
      if (res.data.success) {
        await loadPlaylists()
        ElMessage.success('歌单创建成功')
        return res.data.data.id
      }
    } catch (error) {
      ElMessage.error(error.response?.data?.message || '创建失败')
      throw error
    }
  }
  
  // 获取歌单详情
  async function fetchPlaylist(id) {
    try {
      const res = await axios.get(`/api/playlist/${id}`)
      
      if (res.data.success) {
        currentPlaylist.value = res.data.data
        return res.data.data
      }
    } catch (error) {
      ElMessage.error('获取歌单失败')
      throw error
    }
  }
  
  // 更新歌单
  async function updatePlaylist(id, data) {
    try {
      const res = await axios.put(`/api/playlist/${id}`, data)
      
      if (res.data.success) {
        await loadPlaylists()
        if (currentPlaylist.value?.id === id) {
          await fetchPlaylist(id)
        }
        ElMessage.success('歌单更新成功')
        return true
      }
    } catch (error) {
      ElMessage.error(error.response?.data?.message || '更新失败')
      return false
    }
  }
  
  // 删除歌单
  async function deletePlaylist(id) {
    try {
      const res = await axios.delete(`/api/playlist/${id}`)
      
      if (res.data.success) {
        await loadPlaylists()
        if (currentPlaylist.value?.id === id) {
          currentPlaylist.value = null
        }
        ElMessage.success('歌单删除成功')
        return true
      }
    } catch (error) {
      ElMessage.error(error.response?.data?.message || '删除失败')
      return false
    }
  }
  
  // 添加歌曲到歌单
  async function addSongToPlaylist(playlistId, songInfo, source) {
    try {
      const res = await axios.post(`/api/playlist/${playlistId}/songs`, {
        songInfo,
        source
      })
      
      if (res.data.success) {
        if (currentPlaylist.value?.id === playlistId) {
          await fetchPlaylist(playlistId)
        }
        ElMessage.success('已添加到歌单')
        return true
      }
    } catch (error) {
      ElMessage.error(error.response?.data?.message || '添加失败')
      return false
    }
  }
  
  // 从歌单移除歌曲
  async function removeSongFromPlaylist(playlistId, songId) {
    try {
      const res = await axios.delete(`/api/playlist/${playlistId}/songs/${songId}`)
      
      if (res.data.success) {
        if (currentPlaylist.value?.id === playlistId) {
          await fetchPlaylist(playlistId)
        }
        ElMessage.success('已从歌单移除')
        return true
      }
    } catch (error) {
      ElMessage.error(error.response?.data?.message || '移除失败')
      return false
    }
  }
  
  return {
    // 状态
    playlists,
    currentPlaylist,
    
    // 方法
    loadPlaylists,
    createPlaylist,
    fetchPlaylist,
    updatePlaylist,
    deletePlaylist,
    addSongToPlaylist,
    removeSongFromPlaylist
  }
})
