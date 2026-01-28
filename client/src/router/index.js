import { createRouter, createWebHistory } from 'vue-router'
import SearchView from '@/views/SearchView.vue'
import DownloadView from '@/views/DownloadView.vue'
import SourceView from '@/views/SourceView.vue'
import PlaylistView from '@/views/PlaylistView.vue'
import LeaderboardView from '@/views/LeaderboardView.vue'
import SettingsView from '@/views/SettingsView.vue'

const routes = [
  {
    path: '/',
    redirect: '/search'
  },
  {
    path: '/search',
    name: 'Search',
    component: SearchView,
    meta: { title: '搜索音乐' }
  },
  {
    path: '/download',
    name: 'Download',
    component: DownloadView,
    meta: { title: '下载管理' }
  },
  {
    path: '/source',
    name: 'Source',
    component: SourceView,
    meta: { title: '音源管理' }
  },
  {
    path: '/playlist',
    name: 'Playlist',
    component: PlaylistView,
    meta: { title: '歌单管理' }
  },
  {
    path: '/leaderboard',
    name: 'Leaderboard',
    component: LeaderboardView,
    meta: { title: '音乐榜单' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: SettingsView,
    meta: { title: '系统设置' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = to.meta.title || 'LX Music Web'
  next()
})

export default router
