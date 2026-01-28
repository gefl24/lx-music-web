<template>
  <div class="source-view">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <h2>音源管理</h2>
          <el-upload
            class="upload-source"
            action="/api/source/upload"
            :auto-upload="true"
            :on-success="handleUploadSuccess"
            :on-error="handleUploadError"
            accept=".js"
            :show-file-list="false"
          >
            <el-button type="primary" size="small">
              <el-icon><Upload /></el-icon>
              上传自定义源
            </el-button>
          </el-upload>
        </div>
      </template>

      <div class="source-list">
        <el-empty v-if="sourceList.length === 0" description="暂无音源" />
        <el-table v-else :data="sourceList" style="width: 100%">
          <el-table-column prop="name" label="音源名称" width="200" />
          <el-table-column prop="version" label="版本" width="100" />
          <el-table-column prop="author" label="作者" width="120" />
          <el-table-column prop="status" label="状态" width="100">
            <template #default="{ row }">
              <el-tag :type="row.status === 'active' ? 'success' : 'info'">
                {{ row.status === 'active' ? '启用' : '禁用' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button
                type="primary"
                size="small"
                :icon="row.status === 'active' ? 'SwitchButton' : 'Check'"
                @click="toggleSource(row.id, row.status !== 'active')"
                :loading="loadingSources.includes(row.id)"
              >
                {{ row.status === 'active' ? '禁用' : '启用' }}
              </el-button>
              <el-button
                type="danger"
                size="small"
                :icon="'Delete'"
                @click="deleteSource(row.id)"
                :loading="loadingSources.includes(row.id)"
              >
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { Upload, Delete, Check, SwitchButton } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const sourceList = ref([])
const loadingSources = ref([])

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

// 上传音源成功处理
const handleUploadSuccess = () => {
  ElMessage.success('上传成功')
  loadSources()
}

// 上传音源失败处理
const handleUploadError = () => {
  ElMessage.error('上传失败')
}

// 切换音源状态
const toggleSource = async (id, enable) => {
  loadingSources.value.push(id)
  try {
    await axios.post('/api/source/toggle', {
      id,
      enable
    })
    ElMessage.success(enable ? '启用成功' : '禁用成功')
    loadSources()
  } catch (error) {
    ElMessage.error(enable ? '启用失败' : '禁用失败')
    console.error('Failed to toggle source:', error)
  } finally {
    loadingSources.value = loadingSources.value.filter(sourceId => sourceId !== id)
  }
}

// 删除音源
const deleteSource = async (id) => {
  loadingSources.value.push(id)
  try {
    await axios.delete(`/api/source/delete/${id}`)
    ElMessage.success('删除成功')
    loadSources()
  } catch (error) {
    ElMessage.error('删除失败')
    console.error('Failed to delete source:', error)
  } finally {
    loadingSources.value = loadingSources.value.filter(sourceId => sourceId !== id)
  }
}

// 组件挂载时加载数据
onMounted(() => {
  loadSources()
})
</script>

<style scoped>
.source-view {
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

.source-list {
  margin-top: 20px;
}

.upload-source {
  margin-left: 10px;
}
</style>
