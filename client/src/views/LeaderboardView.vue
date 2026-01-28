<template>
  <div class="leaderboard-view">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <h2>音乐榜单</h2>
          <el-select v-model="selectedSource" placeholder="选择音源" style="width: 200px">
            <el-option
              v-for="source in sourceList"
              :key="source.id"
              :label="source.name"
              :value="source.id"
            />
          </el-select>
        </div>
      </template>

      <div v-if="loading" class="loading-state">
        <el-skeleton :rows="5" animated />
      </div>

      <div v-else-if="!selectedSource" class="empty-state">
        <el-empty description="请先选择音源" />
      </div>

      <div v-else-if="leaderboardData.length === 0" class="empty-state">
        <el-empty description="该音源暂无榜单数据" />
      </div>

      <div v-else class="leaderboard-content">
        <div class="leaderboard-tabs">
          <el-tabs v-model="activeTab" @tab-change="handleTabChange">
            <el-tab-pane
              v-for="board in leaderboardData"
              :key="board.id"
              :label="board.name"
              :name="board.id"
            >
              <div class="board-list">
                <div
                  v-for="(song, index) in board.songs"
                  :key="index"
                  class="song-item"
                >
                  <div class="song-rank">
                    <span class="rank-number" :class="{ 'top-rank': index < 3 }">
                      {{ index + 1 }}
                    </span>
                  </div>
                  <div class="song-info">
                    <h4 class="song-title">{{ song.name }}</h4>
                    <p class="song-artist">{{ song.artist }}</p>
                  </div>
                  <div class="song-actions">
                    <el-button
                      type="primary"
                      size="small"
                      @click="playSong(song)"
                    >
                      <el-icon><Play /></el-icon>
                      播放
                    </el-button>
                    <el-button
                      type="success"
                      size="small"
                      @click="downloadSong(song)"
                    >
                      <el-icon><Download /></el-icon>
                      下载
                    </el-button>
                  </div>
                </div>
              </div>
            </el-tab-pane>
          </el-tabs>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { Play, Download, RefreshLeft } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const sourceList = ref([])
const selectedSource = ref('')
const leaderboardData = ref([])
const activeTab = ref('')
const loading = ref(false)

// 加载音源列表
const loadSources = async () => {
  try {
    const response = await axios.get('/api/source/list')
    sourceList.value = response.data.sources || []
  } catch (error) {
    ElMessage.error('加载音源失败')
    console.error('Failed to load sources:', error)
  }
}

// 加载榜单数据
const loadLeaderboard = async () => {
  if (!selectedSource.value) return

  loading.value = true
  try {
    const response = await axios.get('/api/music/leaderboard', {
      params: {
        sourceId: selectedSource.value
      }
    })
    leaderboardData.value = response.data.leaderboards || []
    if (leaderboardData.value.length > 0) {
      activeTab.value = leaderboardData.value[0].id
    }
  } catch (error) {
    ElMessage.error('加载榜单失败')
    console.error('Failed to load leaderboard:', error)
  } finally {
    loading.value = false
  }
}

// 处理标签页切换
const handleTabChange = () => {
  // 可以在这里添加额外的逻辑
}

// 播放歌曲
const playSong = (song) => {
  ElMessage.info(`播放 ${song.name} - ${song.artist}`)
  // 这里可以实现播放逻辑
}

// 下载歌曲
const downloadSong = (song) => {
  ElMessage.info(`开始下载 ${song.name} - ${song.artist}`)
  // 这里可以实现下载逻辑
}

// 监听音源选择变化
watch(selectedSource, () => {
  leaderboardData.value = []
  activeTab.value = ''
  loadLeaderboard()
})

// 组件挂载时加载数据
onMounted(() => {
  loadSources()
})
</script>

<style scoped>
.leaderboard-view {
  padding: 20px;
}

.page-card {
  max-width: 1200px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  h2 {
    font-size: 20px;
    font-weight: 600;
    margin: 0;
  }
}

.loading-state,
.empty-state {
  padding: 40px 0;
}

.leaderboard-content {
  margin-top: 20px;
}

.leaderboard-tabs {
  margin-top: 20px;
}

.board-list {
  padding: 20px 0;
}

.song-item {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(0, 0, 0, 0.02);
  }
}

.song-rank {
  width: 60px;
  text-align: center;
}

.rank-number {
  font-size: 20px;
  font-weight: 600;
  color: #606266;

  &.top-rank {
    color: #f56c6c;
  }
}

.song-info {
  flex: 1;
  min-width: 0;
}

.song-title {
  font-size: 16px;
  font-weight: 500;
  margin: 0 0 4px 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-artist {
  font-size: 14px;
  color: #909399;
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.song-actions {
  display: flex;
  gap: 8px;
}

@media (max-width: 768px) {
  .song-item {
    flex-direction: column;
    align-items: flex-start;
    padding: 16px;
  }

  .song-rank {
    width: 100%;
    text-align: left;
    margin-bottom: 8px;
  }

  .song-info {
    margin-bottom: 12px;
    width: 100%;
  }

  .song-actions {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
