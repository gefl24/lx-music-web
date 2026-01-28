/**
 * 音源管理状态
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { sourceApi } from '@/api'
import { ElMessage } from 'element-plus'

export const useSourceStore = defineStore('source', () => {
  // 状态
  const sources = ref([])
  const currentSource = ref('test')
  
  // 加载音源列表
  async function loadSources() {
    try {
      const res = await sourceApi.getList()
      sources.value = res.data.saved || []
      
      // 如果有可用的源,设置为当前源
      if (sources.value.length > 0 && sources.value[0].enabled) {
        currentSource.value = sources.value[0].id
      }
    } catch (error) {
      console.error('加载音源列表失败:', error)
    }
  }
  
  // 上传音源
  async function uploadSource(file) {
    try {
      const res = await sourceApi.upload(file)
      
      // 添加到列表
      sources.value.unshift({
        id: res.data.sourceId,
        ...res.data.metadata,
        enabled: 1,
        created_at: Date.now()
      })
      
      ElMessage.success('音源上传成功')
      return res.data.sourceId
    } catch (error) {
      ElMessage.error('上传失败: ' + error.message)
      throw error
    }
  }
  
  // 删除音源
  async function deleteSource(sourceId) {
    try {
      await sourceApi.delete(sourceId)
      
      const index = sources.value.findIndex(s => s.id === sourceId)
      if (index !== -1) {
        sources.value.splice(index, 1)
      }
      
      // 如果删除的是当前源,切换到第一个可用源
      if (currentSource.value === sourceId) {
        const firstEnabled = sources.value.find(s => s.enabled)
        currentSource.value = firstEnabled ? firstEnabled.id : null
      }
      
      ElMessage.success('音源已删除')
    } catch (error) {
      ElMessage.error('删除失败: ' + error.message)
    }
  }
  
  // 切换音源状态
  async function toggleSource(sourceId, enabled) {
    try {
      await sourceApi.toggle(sourceId, enabled)
      
      const source = sources.value.find(s => s.id === sourceId)
      if (source) {
        source.enabled = enabled ? 1 : 0
      }
      
      ElMessage.success(enabled ? '音源已启用' : '音源已禁用')
    } catch (error) {
      ElMessage.error('操作失败: ' + error.message)
    }
  }
  
  // 设置当前音源
  function setCurrentSource(sourceId) {
    currentSource.value = sourceId
    ElMessage.success('已切换音源')
  }
  
  // 导出音源
  function exportSource(sourceId) {
    const url = sourceApi.export(sourceId)
    window.open(url, '_blank')
  }
  
  // 获取启用的音源列表
  function getEnabledSources() {
    return sources.value.filter(s => s.enabled)
  }
  
  return {
    // 状态
    sources,
    currentSource,
    
    // 方法
    loadSources,
    uploadSource,
    deleteSource,
    toggleSource,
    setCurrentSource,
    exportSource,
    getEnabledSources
  }
})
