<template>
  <div class="settings-view">
    <el-card class="page-card">
      <template #header>
        <div class="card-header">
          <h2>系统设置</h2>
        </div>
      </template>

      <div class="settings-content">
        <el-tabs v-model="activeTab">
          <el-tab-pane label="基本设置" name="basic">
            <el-form :model="settings" label-width="120px" class="settings-form">
              <el-form-item label="服务端口">
                <el-input v-model="settings.port" placeholder="请输入端口号" />
                <el-alert
                  :title="'注意：修改端口需要重启服务才能生效'"
                  type="info"
                  :closable="false"
                  show-icon
                  class="setting-alert"
                />
              </el-form-item>
              <el-form-item label="数据存储目录">
                <el-input v-model="settings.dataDir" placeholder="请输入数据目录路径" />
                <el-alert
                  :title="'注意：修改目录需要重启服务才能生效'"
                  type="info"
                  :closable="false"
                  show-icon
                  class="setting-alert"
                />
              </el-form-item>
              <el-form-item label="音乐存储目录">
                <el-input v-model="settings.musicDir" placeholder="请输入音乐目录路径" />
                <el-alert
                  :title="'注意：修改目录需要重启服务才能生效'"
                  type="info"
                  :closable="false"
                  show-icon
                  class="setting-alert"
                />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="saveSettings">保存设置</el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="下载设置" name="download">
            <el-form :model="settings" label-width="120px" class="settings-form">
              <el-form-item label="最大并发下载数">
                <el-input-number
                  v-model="settings.maxConcurrentDownloads"
                  :min="1"
                  :max="10"
                  :step="1"
                />
              </el-form-item>
              <el-form-item label="下载失败重试次数">
                <el-input-number
                  v-model="settings.downloadRetryLimit"
                  :min="0"
                  :max="10"
                  :step="1"
                />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="saveSettings">保存设置</el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="安全设置" name="security">
            <el-form :model="settings" label-width="120px" class="settings-form">
              <el-form-item label="JWT 密钥">
                <el-input
                  v-model="settings.jwtSecret"
                  placeholder="请输入 JWT 签名密钥"
                  show-password
                />
                <el-alert
                  :title="'注意：修改密钥需要重启服务才能生效'"
                  type="info"
                  :closable="false"
                  show-icon
                  class="setting-alert"
                />
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="generateSecret">生成随机密钥</el-button>
                <el-button type="primary" @click="saveSettings">保存设置</el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="系统信息" name="info">
            <el-descriptions :column="1" border>
              <el-descriptions-item label="服务版本">
                {{ systemInfo.version || '未知' }}
              </el-descriptions-item>
              <el-descriptions-item label="运行环境">
                {{ systemInfo.env || '未知' }}
              </el-descriptions-item>
              <el-descriptions-item label="Node.js 版本">
                {{ systemInfo.nodeVersion || '未知' }}
              </el-descriptions-item>
              <el-descriptions-item label="启动时间">
                {{ formatTime(systemInfo.startTime) }}
              </el-descriptions-item>
              <el-descriptions-item label="当前时间">
                {{ formatTime(Date.now()) }}
              </el-descriptions-item>
              <el-descriptions-item label="运行时长">
                {{ formatDuration(systemInfo.uptime) }}
              </el-descriptions-item>
            </el-descriptions>
          </el-tab-pane>
        </el-tabs>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage, ElNotification } from 'element-plus'
import axios from 'axios'

const activeTab = ref('basic')
const settings = ref({
  port: '3000',
  dataDir: '/app/data',
  musicDir: '/app/music',
  maxConcurrentDownloads: 3,
  downloadRetryLimit: 3,
  jwtSecret: ''
})

const systemInfo = ref({
  version: '',
  env: '',
  nodeVersion: '',
  startTime: 0,
  uptime: 0
})

// 加载系统信息
const loadSystemInfo = async () => {
  try {
    const response = await axios.get('/health')
    if (response.data) {
      systemInfo.value = {
        version: response.data.version || '1.0.0',
        env: process.env.NODE_ENV || 'production',
        nodeVersion: process.version || '未知',
        startTime: Date.now() - (process.uptime() * 1000),
        uptime: process.uptime()
      }
    }
  } catch (error) {
    console.error('Failed to load system info:', error)
  }
}

// 保存设置
const saveSettings = () => {
  ElMessage.success('设置已保存')
  ElNotification({
    title: '提示',
    message: '部分设置需要重启服务才能生效',
    type: 'info'
  })
  // 这里可以实现保存设置的逻辑
  // 注意：实际修改需要通过修改 .env 文件或环境变量实现
}

// 生成随机密钥
const generateSecret = () => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+[]{}|;:,.<>?'
  let secret = ''
  for (let i = 0; i < 32; i++) {
    secret += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  settings.value.jwtSecret = secret
  ElMessage.success('已生成随机密钥')
}

// 格式化时间
const formatTime = (timestamp) => {
  if (!timestamp) return '未知'
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// 格式化时长
const formatDuration = (seconds) => {
  if (!seconds) return '未知'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  let result = ''
  if (hours > 0) result += `${hours}小时 `
  if (minutes > 0) result += `${minutes}分钟 `
  result += `${secs}秒`
  
  return result
}

// 组件挂载时加载数据
onMounted(() => {
  loadSystemInfo()
})
</script>

<style scoped>
.settings-view {
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

.settings-content {
  margin-top: 20px;
}

.settings-form {
  margin-top: 20px;
}

.setting-alert {
  margin-top: 8px;
  width: 100%;
}

@media (max-width: 768px) {
  .settings-form {
    .el-form-item {
      label-width: 100px !important;
    }
  }
}
</style>
