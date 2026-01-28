<template>
  <div id="app">
    <el-container>
      <el-aside width="200px">
        <div class="logo">
          <h1>🎵 LX Music</h1>
        </div>
        <el-menu
          :default-active="$route.path"
          router
          class="menu"
        >
          <el-menu-item index="/search">
            <el-icon><Search /></el-icon>
            <span>搜索音乐</span>
          </el-menu-item>
          <el-menu-item index="/download">
            <el-icon><Download /></el-icon>
            <span>下载管理</span>
          </el-menu-item>
        </el-menu>
      </el-aside>
      
      <el-container>
        <el-main>
          <router-view />
        </el-main>
        
        <MusicPlayer />
      </el-container>
    </el-container>
  </div>
</template>

<script setup>
import MusicPlayer from '@/components/MusicPlayer.vue'
import { Search, Download } from '@element-plus/icons-vue'
</script>

<style lang="scss">
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
}

#app {
  .el-container {
    height: 100%;
  }
  
  .el-aside {
    background: linear-gradient(180deg, #667eea 0%, #764ba2 100%);
    color: #fff;
    
    .logo {
      padding: 20px;
      text-align: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      
      h1 {
        font-size: 20px;
        font-weight: 600;
      }
    }
    
    .menu {
      background: transparent;
      border: none;
      
      .el-menu-item {
        color: rgba(255, 255, 255, 0.8);
        
        &:hover {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }
        
        &.is-active {
          background: rgba(255, 255, 255, 0.2);
          color: #fff;
        }
      }
    }
  }
  
  .el-main {
    padding: 0;
    padding-bottom: 80px;
    background: #f5f7fa;
    overflow: auto;
  }
}
</style>
