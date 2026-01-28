<template>
  <div class="download-view">
    <div class="download-header">
      <h2>下载管理</h2>
      <div class="header-actions">
        <el-button :icon="Refresh" @click="loadTasks">刷新</el-button>
        <el-select v-model="filterStatus" placeholder="筛选状态" style="width: 120px">
          <el-option label="全部" value="" />
          <el-option label="下载中" value="downloading" />
          <el-option label="已完成" value="completed" />
          <el-option label="失败" value="failed" />
        </el-select>
      </div>
    </div>

    <div class="stats-card">
      <el-row :gutter="20">
        <el-col :span="8">
          <div class="stat-item">
            <div class="stat-label">队列中</div>
            <div class="stat-value">{{ stats.queue }}</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="stat-item">
            <div class="stat-label">下载中</div>
            <div class="stat-value">{{ stats.active }}</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="stat-item">
            <div class="stat-label">总任务</div>
            <div class="stat-value">{{ tasks.length }}</div>
          </div>
        </el-col>
      </el-row>
    </div>

    <div class="download-list">
      <el-table 
        :data="filteredTasks" 
        style="width: 100%"
        v-loading="loading"
      >
        <el-table-column type="index" width="50" label="#" />
        
        <el-table-column prop="song_name" label="歌曲" min-width="200" />
        
        <el-table-column prop="artist" label="歌手" width="150" />
        
        <el-table-column prop="quality" label="音质" width="80" />
        
        <el-table-column label="状态" width="120">
          <template #default="{ row }">
            <el-tag 
              :type="getStatusType(row.status)" 
              size="small"
            >
              {{ getStatusText(row.status) }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column label="进度" width="200">
          <template #default="{ row }">
            <el-progress 
              :percentage="row.progress || 0" 
              :status="getProgressStatus(row.status)"
            />
          </template>
        </el-table-column>
        
        <el-table-column label="大小" width="120">
          <template #default="{ row }">
            <span v-if="row.total_size">
              {{ formatSize(row.downloaded_size || 0) }} / {{ formatSize(row.total_size) }}
            </span>
            <span v-else-if="row.file_size">
              {{ formatSize(row.file_size) }}
            </span>
            <span v-else>--</span>
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'downloading' || row.status === 'pending'"
              size="small"
              @click="pauseTask(row.id)"
            >
              暂停
            </el-button>
            <el-button
              v-else-if="row.status === 'paused' || row.status === 'failed'"
              size="small"
              @click="resumeTask(row.id)"
            >
              恢复
            </el-button>
            <el-button
              size="small"
              type="danger"
              @click="deleteTask(row.id)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useDownloadStore } from '@/stores/download'
import { Refresh } from '@element-plus/icons-vue'

const downloadStore = useDownloadStore()

// 状态
const loading = ref(false)
const filterStatus = ref('')

// 计算属性
const tasks = computed(() => downloadStore.tasks)
const stats = computed(() => downloadStore.stats)

const filteredTasks = computed(() => {
  if (!filterStatus.value) return tasks.value
  return tasks.value.filter(t => t.status === filterStatus.value)
})

// 方法
const { formatSize } = downloadStore

async function loadTasks() {
  loading.value = true
  try {
    await downloadStore.loadTasks(filterStatus.value || null)
    await downloadStore.loadStats()
  } finally {
    loading.value = false
  }
}

function pauseTask(taskId) {
  downloadStore.pauseTask(taskId)
}

function resumeTask(taskId) {
  downloadStore.resumeTask(taskId)
}

function deleteTask(taskId) {
  downloadStore.deleteTask(taskId)
}

function getStatusType(status) {
  const types = {
    pending: 'info',
    downloading: 'warning',
    completed: 'success',
    failed: 'danger',
    paused: 'info'
  }
  return types[status] || 'info'
}

function getStatusText(status) {
  const texts = {
    pending: '等待中',
    downloading: '下载中',
    completed: '已完成',
    failed: '失败',
    paused: '已暂停'
  }
  return texts[status] || status
}

function getProgressStatus(status) {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'exception'
  return undefined
}

// 监听筛选变化
watch(filterStatus, () => {
  loadTasks()
})

// 初始化
onMounted(() => {
  downloadStore.initSocket()
  loadTasks()
})
</script>

<style scoped lang="scss">
.download-view {
  padding: 20px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.download-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  
  h2 {
    margin: 0;
  }
  
  .header-actions {
    display: flex;
    gap: 10px;
  }
}

.stats-card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,.1);
  
  .stat-item {
    text-align: center;
    
    .stat-label {
      font-size: 14px;
      color: #909399;
      margin-bottom: 8px;
    }
    
    .stat-value {
      font-size: 28px;
      font-weight: bold;
      color: #409eff;
    }
  }
}

.download-list {
  flex: 1;
  overflow: auto;
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,.1);
}
</style>
