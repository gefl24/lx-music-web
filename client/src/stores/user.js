/**
 * 用户认证状态管理
 */

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

export const useUserStore = defineStore('user', () => {
  // 状态
  const token = ref(localStorage.getItem('token') || '')
  const userInfo = ref(JSON.parse(localStorage.getItem('userInfo') || 'null'))
  
  // 计算属性
  const isLoggedIn = computed(() => !!token.value)
  const isAdmin = computed(() => userInfo.value?.role === 'admin')
  
  // 设置 token
  function setToken(newToken) {
    token.value = newToken
    localStorage.setItem('token', newToken)
    
    // 设置 axios 默认 header
    if (newToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${newToken}`
    } else {
      delete axios.defaults.headers.common['Authorization']
    }
  }
  
  // 设置用户信息
  function setUserInfo(info) {
    userInfo.value = info
    localStorage.setItem('userInfo', JSON.stringify(info))
  }
  
  // 注册
  async function register(username, password, email) {
    try {
      const res = await axios.post('/api/user/register', {
        username,
        password,
        email
      })
      
      if (res.data.success) {
        setToken(res.data.data.token)
        setUserInfo(res.data.data.user)
        ElMessage.success('注册成功')
        return true
      }
    } catch (error) {
      ElMessage.error(error.response?.data?.message || '注册失败')
      return false
    }
  }
  
  // 登录
  async function login(username, password) {
    try {
      const res = await axios.post('/api/user/login', {
        username,
        password
      })
      
      if (res.data.success) {
        setToken(res.data.data.token)
        setUserInfo(res.data.data.user)
        ElMessage.success('登录成功')
        return true
      }
    } catch (error) {
      ElMessage.error(error.response?.data?.message || '登录失败')
      return false
    }
  }
  
  // 登出
  function logout() {
    setToken('')
    setUserInfo(null)
    ElMessage.success('已退出登录')
  }
  
  // 获取个人信息
  async function fetchProfile() {
    try {
      const res = await axios.get('/api/user/profile')
      
      if (res.data.success) {
        setUserInfo(res.data.data)
      }
    } catch (error) {
      console.error('获取个人信息失败:', error)
    }
  }
  
  // 更新个人信息
  async function updateProfile(data) {
    try {
      const res = await axios.put('/api/user/profile', data)
      
      if (res.data.success) {
        await fetchProfile()
        ElMessage.success('信息更新成功')
        return true
      }
    } catch (error) {
      ElMessage.error(error.response?.data?.message || '更新失败')
      return false
    }
  }
  
  // 修改密码
  async function changePassword(oldPassword, newPassword) {
    try {
      const res = await axios.put('/api/user/password', {
        oldPassword,
        newPassword
      })
      
      if (res.data.success) {
        ElMessage.success('密码修改成功')
        return true
      }
    } catch (error) {
      ElMessage.error(error.response?.data?.message || '修改失败')
      return false
    }
  }
  
  // 初始化 (设置 axios header)
  if (token.value) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
  }
  
  return {
    // 状态
    token,
    userInfo,
    isLoggedIn,
    isAdmin,
    
    // 方法
    register,
    login,
    logout,
    fetchProfile,
    updateProfile,
    changePassword
  }
})
