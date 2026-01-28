import { createRouter, createWebHistory } from 'vue-router'
import SearchView from '@/views/SearchView.vue'
import DownloadView from '@/views/DownloadView.vue'

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
