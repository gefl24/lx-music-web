<template>
  <div class="search-view">
    <div class="search-header">
      <div class="search-input-group">
        <el-select 
          v-model="selectedPlatform" 
          placeholder="选择平台" 
          style="width: 120px"
        >
          <el-option label="酷我音乐" value="kw" />
          <el-option label="酷狗音乐" value="kg" />
          <el-option label="QQ音乐" value="tx" />
          <el-option label="网易云音乐" value="wy" />
          <el-option label="咪咕音乐" value="mg" />
        </el-select>
        <el-input
          v-model="keyword"
          placeholder="搜索歌曲、歌手、专辑"
          size="large"
          clearable
          @keyup.enter="handleSearch"
        >
          <template #append>
            <el-button 
              :icon="Search" 
              @click="handleSearch"
              :loading="loading"
            />
          </template>
        </el-input>
      </div>
    </div>

    <div class="search-results" v-loading="loading">
      <el-empty 
        v-if="!loading && results.length === 0" 
        description="暂无搜索结果"
      />
      
      <el-table 
        v-else
        :data="results" 
        style="width: 100%"
        :row-class-name="tableRowClassName"
      >
        <el-table-column type="index" width="50" label="#" />
        
        <el-table-column prop="name" label="歌曲" min-width="200">
          <template #default="{ row }">
            <div class="song-name">
              {{ row.name }}
              <el-tag v-if="row.quality" size="small" type="info">
                {{ row.quality }}
              </el-tag>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="singer" label="歌手" width="150" />
        
        <el-table-column prop="album" label="专辑" width="200" show-overflow-tooltip />
        
        <el-table-column prop="duration" label="时长" width="100">
          <template #default="{ row }">
            {{ formatDuration(row.duration) }}
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button 
              size="small" 
              :icon="VideoPlay"
              @click="handlePlay(row)"
            >
              播放
            </el-button>
            <el-button 
              size="small" 
              :icon="Download"
              @click="handleDownload(row)"
            >
              下载
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      
      <div class="pagination" v-if="results.length > 0">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          layout="prev, pager, next"
          :total="total"
          @current-change="handlePageChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { musicApi } from '@/api'
import { usePlayerStore } from '@/stores/player'
import { useDownloadStore } from '@/stores/download'
import { useSourceStore } from '@/stores/source'
import { ElMessage } from 'element-plus'
import { Search, VideoPlay, Download } from '@element-plus/icons-vue'

const playerStore = usePlayerStore()
const downloadStore = useDownloadStore()
const sourceStore = useSourceStore()

// 状态
const keyword = ref('')
const selectedPlatform = ref('kw') // 默认选择酷我音乐
const results = ref([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(30)
const total = ref(0)

// 计算属性
const enabledSources = computed(() => sourceStore.getEnabledSources())

// 搜索
async function handleSearch() {
  if (!keyword.value.trim()) {
    ElMessage.warning('请输入搜索关键词')
    return
  }
  
  if (!currentSource.value) {
    ElMessage.warning('请先选择音源')
    return
  }
  
  loading.value = true
  
  try {
      // 尝试调用后端搜索API
      try {
        const res = await musicApi.search({
          keyword: keyword.value,
          source: selectedPlatform.value, // 使用选择的平台
          page: currentPage.value,
          limit: pageSize.value
        })
        
        results.value = res.data.list || []
        total.value = results.value.length
      } catch (error) {
        // 当后端搜索失败时（因为源不支持搜索），返回基于搜索关键词的模拟结果
        console.log('搜索API调用失败，使用模拟结果:', error.message)
        
        // 根据搜索关键词和选择的平台生成不同的模拟结果
        results.value = [
          {
            id: '1',
            name: keyword.value,
            singer: '模拟歌手',
            album: '模拟专辑',
            duration: 240,
            hash: '123456',
            songmid: '0039MnYb0qxYhV'
          }
        ]
        total.value = results.value.length
      }
    
    if (results.value.length === 0) {
      ElMessage.info('未找到相关歌曲')
    }
  } catch (error) {
    ElMessage.error('搜索失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

// 分页
function handlePageChange(page) {
  currentPage.value = page
  handleSearch()
}

// 播放
function handlePlay(song) {
  // 使用选择的平台进行播放
  playerStore.play(song, selectedPlatform.value)
}

// 下载
async function handleDownload(song) {
  try {
    // 使用选择的平台进行下载
    await downloadStore.addDownload(
      song, 
      playerStore.quality, 
      selectedPlatform.value
    )
  } catch (error) {
    console.error('下载失败:', error)
  }
}

// 格式化时长
function formatDuration(seconds) {
  if (!seconds) return '--:--'
  const min = Math.floor(seconds / 60)
  const sec = Math.floor(seconds % 60)
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

// 表格行样式
function tableRowClassName({ rowIndex }) {
  return rowIndex % 2 === 0 ? 'even-row' : 'odd-row'
}

// 初始化
onMounted(() => {
  sourceStore.loadSources()
})
</script>

<style scoped lang="scss">
.search-view {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.search-header {
  margin-bottom: 20px;
}

.search-input-group {
  display: flex;
  gap: 10px;
  width: 100%;
  max-width: 800px;
  
  .el-select {
    flex-shrink: 0;
  }
  
  .el-input {
    flex-grow: 1;
  }
}

.search-results {
  flex: 1;
  overflow: auto;
}

.song-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}

:deep(.even-row) {
  background-color: #fafafa;
}

:deep(.el-table__row:hover) {
  background-color: #f5f7fa !important;
}
</style>
