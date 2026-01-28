/**
 * 播放器状态管理
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { musicApi } from '@/api'
import { ElMessage } from 'element-plus'

export const usePlayerStore = defineStore('player', () => {
  // 状态
  const currentSong = ref(null)
  const playlist = ref([])
  const currentIndex = ref(0)
  const isPlaying = ref(false)
  const volume = ref(0.8)
  const currentTime = ref(0)
  const duration = ref(0)
  const quality = ref('128k')
  
  // Audio 对象
  const audio = ref(null)
  
  // 计算属性
  const progress = computed(() => {
    if (!duration.value) return 0
    return (currentTime.value / duration.value) * 100
  })
  
  const hasNext = computed(() => {
    return currentIndex.value < playlist.value.length - 1
  })
  
  const hasPrev = computed(() => {
    return currentIndex.value > 0
  })
  
  // 初始化音频对象
  function initAudio() {
    if (!audio.value) {
      audio.value = new Audio()
      audio.value.volume = volume.value
      
      // 监听事件
      audio.value.addEventListener('timeupdate', () => {
        currentTime.value = audio.value.currentTime
      })
      
      audio.value.addEventListener('loadedmetadata', () => {
        duration.value = audio.value.duration
      })
      
      audio.value.addEventListener('ended', () => {
        next()
      })
      
      audio.value.addEventListener('error', (e) => {
        ElMessage.error('播放失败')
        console.error('Audio error:', e)
      })
    }
  }
  
  // 播放歌曲
  async function play(song, source) {
    try {
      initAudio()
      
      // 获取播放链接
      const res = await musicApi.getMusicUrl({
        songInfo: song,
        quality: quality.value,
        source
      })
      
      let url = res.data.url
      
      // 如果是直接 URL,通过代理播放
      if (url && !url.startsWith('blob:')) {
        url = `/api/proxy/stream?url=${encodeURIComponent(url)}&source=${source}`
      }
      
      // 设置音频源
      audio.value.src = url
      audio.value.play()
      
      // 更新状态
      currentSong.value = { ...song, source }
      isPlaying.value = true
      
      // 如果不在播放列表中,添加进去
      const index = playlist.value.findIndex(s => s.id === song.id)
      if (index === -1) {
        playlist.value.push({ ...song, source })
        currentIndex.value = playlist.value.length - 1
      } else {
        currentIndex.value = index
      }
      
    } catch (error) {
      ElMessage.error('播放失败: ' + error.message)
      console.error('Play error:', error)
    }
  }
  
  // 暂停
  function pause() {
    if (audio.value) {
      audio.value.pause()
      isPlaying.value = false
    }
  }
  
  // 继续播放
  function resume() {
    if (audio.value) {
      audio.value.play()
      isPlaying.value = true
    }
  }
  
  // 切换播放/暂停
  function toggle() {
    if (isPlaying.value) {
      pause()
    } else {
      resume()
    }
  }
  
  // 下一首
  function next() {
    if (hasNext.value) {
      currentIndex.value++
      const song = playlist.value[currentIndex.value]
      play(song, song.source)
    }
  }
  
  // 上一首
  function prev() {
    if (hasPrev.value) {
      currentIndex.value--
      const song = playlist.value[currentIndex.value]
      play(song, song.source)
    }
  }
  
  // 跳转到指定位置
  function seek(time) {
    if (audio.value) {
      audio.value.currentTime = time
    }
  }
  
  // 设置音量
  function setVolume(val) {
    volume.value = val
    if (audio.value) {
      audio.value.volume = val
    }
  }
  
  // 设置音质
  function setQuality(val) {
    quality.value = val
  }
  
  // 添加到播放列表
  function addToPlaylist(song, source) {
    const exists = playlist.value.find(s => s.id === song.id)
    if (!exists) {
      playlist.value.push({ ...song, source })
      ElMessage.success('已添加到播放列表')
    } else {
      ElMessage.info('歌曲已在播放列表中')
    }
  }
  
  // 从播放列表移除
  function removeFromPlaylist(index) {
    playlist.value.splice(index, 1)
    if (currentIndex.value >= index) {
      currentIndex.value--
    }
  }
  
  // 清空播放列表
  function clearPlaylist() {
    playlist.value = []
    currentIndex.value = 0
  }
  
  return {
    // 状态
    currentSong,
    playlist,
    currentIndex,
    isPlaying,
    volume,
    currentTime,
    duration,
    quality,
    progress,
    hasNext,
    hasPrev,
    
    // 方法
    play,
    pause,
    resume,
    toggle,
    next,
    prev,
    seek,
    setVolume,
    setQuality,
    addToPlaylist,
    removeFromPlaylist,
    clearPlaylist
  }
})
