/**
 * 标签管理状态
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

export const useTagStore = defineStore('tag', () => {
  // 状态
  const tags = ref([])
  const currentTag = ref(null)
  
  // 加载标签列表
  async function loadTags() {
    try {
      const res = await axios.get('/api/tag/list')
      
      if (res.data.success) {
        tags.value = res.data.data
      }
    } catch (error) {
      console.error('加载标签列表失败:', error)
    }
  }
  
  // 创建标签
  async function createTag(data) {
    try {
      const res = await axios.post('/api/tag/create', data)
      
      if (res.data.success) {
        await loadTags()
        ElMessage.success('标签创建成功')
        return res.data.data.id
      }
    } catch (error) {
      ElMessage.error(error.response?.data?.message || '创建失败')
      throw error
    }
  }
  
  // 更新标签
  async function updateTag(id, data) {
    try {
      const res = await axios.put(`/api/tag/${id}`, data)
      
      if (res.data.success) {
        await loadTags()
        ElMessage.success('标签更新成功')
        return true
      }
    } catch (error) {
      ElMessage.error(error.response?.data?.message || '更新失败')
      return false
    }
  }
  
  // 删除标签
  async function deleteTag(id) {
    try {
      const res = await axios.delete(`/api/tag/${id}`)
      
      if (res.data.success) {
        await loadTags()
        ElMessage.success('标签删除成功')
        return true
      }
    } catch (error) {
      ElMessage.error(error.response?.data?.message || '删除失败')
      return false
    }
  }
  
  // 为歌曲添加标签
  async function addTagToSong(songInfo, source, tagId) {
    try {
      const res = await axios.post('/api/tag/song', {
        songInfo,
        source,
        tagId
      })
      
      if (res.data.success) {
        ElMessage.success('标签添加成功')
        return true
      }
    } catch (error) {
      ElMessage.error(error.response?.data?.message || '添加失败')
      return false
    }
  }
  
  // 移除歌曲标签
  async function removeTagFromSong(songId, tagId) {
    try {
      const res = await axios.delete(`/api/tag/song/${songId}/${tagId}`)
      
      if (res.data.success) {
        ElMessage.success('标签移除成功')
        return true
      }
    } catch (error) {
      ElMessage.error(error.response?.data?.message || '移除失败')
      return false
    }
  }
  
  // 获取标签下的歌曲
  async function fetchTagSongs(tagId, page = 1, limit = 50) {
    try {
      const res = await axios.get(`/api/tag/${tagId}/songs`, {
        params: { page, limit }
      })
      
      if (res.data.success) {
        currentTag.value = res.data.data
        return res.data.data
      }
    } catch (error) {
      ElMessage.error('获取歌曲列表失败')
      throw error
    }
  }
  
  // 获取歌曲的标签
  async function fetchSongTags(songId) {
    try {
      const res = await axios.get(`/api/tag/song/${songId}`)
      
      if (res.data.success) {
        return res.data.data
      }
    } catch (error) {
      console.error('获取歌曲标签失败:', error)
      return []
    }
  }
  
  return {
    // 状态
    tags,
    currentTag,
    
    // 方法
    loadTags,
    createTag,
    updateTag,
    deleteTag,
    addTagToSong,
    removeTagFromSong,
    fetchTagSongs,
    fetchSongTags
  }
})
