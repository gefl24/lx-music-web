<template>
  <div class="music-player" v-if="currentSong">
    <div class="player-info">
      <div class="song-cover">
        <el-icon :size="40"><Headset /></el-icon>
      </div>
      <div class="song-detail">
        <div class="song-name">{{ currentSong.name }}</div>
        <div class="song-artist">{{ currentSong.singer }}</div>
      </div>
    </div>
    
    <div class="player-controls">
      <div class="control-buttons">
        <el-button 
          circle 
          :disabled="!hasPrev" 
          @click="playerStore.prev()"
        >
          <el-icon><DArrowLeft /></el-icon>
        </el-button>
        
        <el-button 
          circle 
          type="primary" 
          size="large"
          @click="playerStore.toggle()"
        >
          <el-icon v-if="isPlaying"><VideoPause /></el-icon>
          <el-icon v-else><VideoPlay /></el-icon>
        </el-button>
        
        <el-button 
          circle 
          :disabled="!hasNext" 
          @click="playerStore.next()"
        >
          <el-icon><DArrowRight /></el-icon>
        </el-button>
      </div>
      
      <div class="progress-bar">
        <span class="time">{{ formatTime(currentTime) }}</span>
        <el-slider 
          v-model="progressValue"
          :show-tooltip="false"
          @change="handleSeek"
        />
        <span class="time">{{ formatTime(duration) }}</span>
      </div>
    </div>
    
    <div class="player-extra">
      <el-popover placement="top" :width="160">
        <template #reference>
          <el-button circle>
            <el-icon><Operation /></el-icon>
          </el-button>
        </template>
        <div class="volume-control">
          <el-icon><Microphone /></el-icon>
          <el-slider 
            v-model="volumeValue" 
            :show-tooltip="false"
            @change="handleVolumeChange"
          />
        </div>
      </el-popover>
      
      <el-select 
        v-model="qualityValue" 
        size="small" 
        style="width: 90px"
        @change="handleQualityChange"
      >
        <el-option label="流畅" value="128k" />
        <el-option label="标准" value="192k" />
        <el-option label="高品" value="320k" />
        <el-option label="无损" value="flac" />
      </el-select>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { usePlayerStore } from '@/stores/player'
import { 
  Headset, 
  DArrowLeft, 
  DArrowRight, 
  VideoPlay, 
  VideoPause,
  Operation,
  Microphone
} from '@element-plus/icons-vue'

const playerStore = usePlayerStore()

// 响应式数据
const progressValue = ref(0)
const volumeValue = ref(80)
const qualityValue = ref('128k')

// 计算属性
const currentSong = computed(() => playerStore.currentSong)
const isPlaying = computed(() => playerStore.isPlaying)
const currentTime = computed(() => playerStore.currentTime)
const duration = computed(() => playerStore.duration)
const hasNext = computed(() => playerStore.hasNext)
const hasPrev = computed(() => playerStore.hasPrev)

// 监听进度变化
watch(() => playerStore.progress, (val) => {
  progressValue.value = val
})

// 处理进度拖动
function handleSeek(val) {
  const time = (val / 100) * duration.value
  playerStore.seek(time)
}

// 处理音量调节
function handleVolumeChange(val) {
  playerStore.setVolume(val / 100)
}

// 处理音质切换
function handleQualityChange(val) {
  playerStore.setQuality(val)
}

// 格式化时间
function formatTime(seconds) {
  if (!seconds || isNaN(seconds)) return '00:00'
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}
</script>

<style scoped lang="scss">
.music-player {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 80px;
  background: #fff;
  border-top: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 20px;
  z-index: 1000;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 200px;
  
  .song-cover {
    width: 50px;
    height: 50px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
  }
  
  .song-detail {
    flex: 1;
    overflow: hidden;
    
    .song-name {
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    
    .song-artist {
      font-size: 12px;
      color: #909399;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
}

.player-controls {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  
  .control-buttons {
    display: flex;
    justify-content: center;
    gap: 10px;
  }
  
  .progress-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    
    .time {
      font-size: 12px;
      color: #909399;
      min-width: 40px;
      text-align: center;
    }
    
    .el-slider {
      flex: 1;
    }
  }
}

.player-extra {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 150px;
  justify-content: flex-end;
}

.volume-control {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px;
}
</style>
