<template>
  <div class="playlist-view">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <h2>歌单管理</h2>
          <el-button type="primary" size="small" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            创建歌单
          </el-button>
        </div>
      </template>

      <el-dialog
        v-model="showCreateDialog"
        title="创建新歌单"
        width="400px"
      >
        <el-form :model="newPlaylist" label-width="80px">
          <el-form-item label="歌单名称">
            <el-input v-model="newPlaylist.name" placeholder="请输入歌单名称" />
          </el-form-item>
          <el-form-item label="歌单描述">
            <el-input
              v-model="newPlaylist.description"
              type="textarea"
              placeholder="请输入歌单描述（可选）"
              :rows="3"
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <span class="dialog-footer">
            <el-button @click="showCreateDialog = false">取消</el-button>
            <el-button type="primary" @click="createPlaylist">创建</el-button>
          </span>
        </template>
      </el-dialog>

      <div class="playlist-list">
        <el-empty v-if="playlistList.length === 0" description="暂无歌单" />
        <div v-else class="playlist-grid">
          <div
            v-for="playlist in playlistList"
            :key="playlist.id"
            class="playlist-card"
          >
            <div class="playlist-header">
              <h3>{{ playlist.name }}</h3>
              <div class="playlist-actions">
                <el-button
                  type="text"
                  size="small"
                  @click="editPlaylist(playlist)"
                >
                  编辑
                </el-button>
                <el-button
                  type="text"
                  size="small"
                  text-color="#f56c6c"
                  @click="deletePlaylist(playlist.id)"
                >
                  删除
                </el-button>
              </div>
            </div>
            <div class="playlist-info">
              <p class="playlist-description">{{ playlist.description || '暂无描述' }}</p>
              <p class="playlist-count">
                <el-icon><Collection /></el-icon>
                {{ playlist.songCount || 0 }} 首歌曲
              </p>
            </div>
            <div class="playlist-footer">
              <el-button
                type="primary"
                size="small"
                plain
                @click="viewPlaylist(playlist)"
              >
                查看详情
              </el-button>
            </div>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Plus, Collection, Delete, Edit } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import axios from 'axios'

const playlistList = ref([])
const showCreateDialog = ref(false)
const newPlaylist = ref({
  name: '',
  description: ''
})

// 加载歌单列表
const loadPlaylists = async () => {
  try {
    const response = await axios.get('/api/playlist/list')
    // 修复：正确读取后端返回的数据结构
    playlistList.value = response.data.data || []
  } catch (error) {
    ElMessage.error('加载歌单失败')
    console.error('Failed to load playlists:', error)
  }
}

// 创建歌单
const createPlaylist = async () => {
  if (!newPlaylist.value.name.trim()) {
    ElMessage.warning('请输入歌单名称')
    return
  }

  try {
    await axios.post('/api/playlist/create', newPlaylist.value)
    ElMessage.success('创建成功')
    showCreateDialog.value = false
    newPlaylist.value = {
      name: '',
      description: ''
    }
    loadPlaylists()
  } catch (error) {
    ElMessage.error('创建失败')
    console.error('Failed to create playlist:', error)
  }
}

// 编辑歌单
const editPlaylist = (playlist) => {
  ElMessage.info('编辑功能开发中')
}

// 删除歌单
const deletePlaylist = async (id) => {
  try {
    await ElMessageBox.confirm(
      '确定要删除这个歌单吗？',
      '警告',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    // 修复：修正删除接口的 URL 路径
    await axios.delete(`/api/playlist/${id}`)
    ElMessage.success('删除成功')
    loadPlaylists()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败')
      console.error('Failed to delete playlist:', error)
    }
  }
}

// 查看歌单详情
const viewPlaylist = (playlist) => {
  ElMessage.info('查看详情功能开发中')
}

// 组件挂载时加载数据
onMounted(() => {
  loadPlaylists()
})
</script>

<style scoped>
.playlist-view {
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

.playlist-list {
  margin-top: 20px;
}

.playlist-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 20px;
}

.playlist-card {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 20px;
  transition: all 0.3s ease;
  background: #fff;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }
}

.playlist-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;

  h3 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
    flex: 1;
  }
}

.playlist-actions {
  display: flex;
  gap: 8px;
}

.playlist-info {
  margin-bottom: 16px;
}

.playlist-description {
  font-size: 14px;
  color: #606266;
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.playlist-count {
  font-size: 13px;
  color: #909399;
  margin: 0;
  display: flex;
  align-items: center;
  gap: 4px;
}

.playlist-footer {
  display: flex;
  justify-content: flex-end;
}

.dialog-footer {
  width: 100%;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
