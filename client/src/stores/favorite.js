/**
 * 收藏订阅状态管理
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

export const useFavoriteStore = defineStore('favorite', () => {
  // 状态
  const favoriteSongs = ref([])
  const favoritePlaylists = ref([])
  const favoriteStatus = ref({ songs: {}, playlists: {} })
  
  // 加载收藏的歌曲
  async function loadFavoriteSongs(page = 1, limit = 50) {
    try {
      const res = await axios.get('/api/favorite/songs', { params: { page, limit } })
      
      if (res.data.success) {
        favoriteSongs.value = res.data.data.songs
        return res.data.data
      }
    } catch (error) {
      console.error('加载收藏歌曲失败:', error)
    }
  }
  
  // 收藏歌曲
  async function favoriteSong(songInfo, source) {
    try {
      const res = await axios.post('/api/favorite/song', { songInfo, source })
      
      if (res.data.success) {
        favoriteStatus.value.songs[songInfo.id] = true
        ElMessage.success('收藏成功')
        return true
      }
    } catch (error) {
      ElMessage.error(error.response?.data?.message || '收藏失败')
      return false
    }
  }
  
  // 取消收藏歌曲
  async function unfavoriteSong(songId) {
    try {
      const res = await axios.delete(`/api/favorite/song/${songId}`)
      
      if (res.data.success) {
        favoriteStatus.value.songs[songId] = false
        favoriteSongs.value = favoriteSongs.value.filter(s => s.id !== songId)
        ElMessage.success('取消收藏')
        return true
      }
    } catch (error) {
      ElMessage.error(error.response?.data?.message || '操作失败')
      return false
    }
  }
  
  // 加载订阅的歌单
  async function loadFavoritePlaylists() {
    try {
      const res = await axios.get('/api/favorite/playlists')
      
      if (res.data.success) {
        favoritePlaylists.value = res.data.data
      }
    } catch (error) {
      console.error('加载订阅歌单失败:', error)
    }
  }
  
  // 订阅歌单
  async function favoritePlaylist(playlistId) {
    try {
      const res = await axios.post('/api/favorite/playlist', { playlistId })
      
      if (res.data.success) {
        favoriteStatus.value.playlists[playlistId] = true
        ElMessage.success('订阅成功')
        return true
      }
    } catch (error) {
      ElMessage.error(error.response?.data?.message || '订阅失败')
      return false
    }
  }
  
  // 取消订阅歌单
  async function unfavoritePlaylist(playlistId) {
    try {
      const res = await axios.delete(`/api/favorite/playlist/${playlistId}`)
      
      if (res.data.success) {
        favoriteStatus.value.playlists[playlistId] = false
        favoritePlaylists.value = favoritePlaylists.value.filter(p => p.id !== playlistId)
        ElMessage.success('取消订阅')
        return true
      }
    } catch (error) {
      ElMessage.error(error.response?.data?.message || '操作失败')
      return false
    }
  }
  
  // 检查收藏状态
  async function checkFavoriteStatus(songIds = [], playlistIds = []) {
    try {
      const params = {}
      if (songIds.length > 0) params.songIds = songIds.join(',')
      if (playlistIds.length > 0) params.playlistIds = playlistIds.join(',')
      
      const res = await axios.get('/api/favorite/check', { params })
      
      if (res.data.success) {
        favoriteStatus.value = res.data.data
      }
    } catch (error) {
      console.error('检查收藏状态失败:', error)
    }
  }
  
  // 切换收藏状态
  async function toggleFavoriteSong(songInfo, source) {
    const isFavorited = favoriteStatus.value.songs[songInfo.id]
    
    if (isFavorited) {
      return await unfavoriteSong(songInfo.id)
    } else {
      return await favoriteSong(songInfo, source)
    }
  }
  
  // 切换订阅状态
  async function toggleFavoritePlaylist(playlistId) {
    const isFavorited = favoriteStatus.value.playlists[playlistId]
    
    if (isFavorited) {
      return await unfavoritePlaylist(playlistId)
    } else {
      return await favoritePlaylist(playlistId)
    }
  }
  
  return {
    // 状态
    favoriteSongs,
    favoritePlaylists,
    favoriteStatus,
    
    // 方法
    loadFavoriteSongs,
    favoriteSong,
    unfavoriteSong,
    loadFavoritePlaylists,
    favoritePlaylist,
    unfavoritePlaylist,
    checkFavoriteStatus,
    toggleFavoriteSong,
    toggleFavoritePlaylist
  }
})
