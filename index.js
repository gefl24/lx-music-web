/**
 * 服务器入口文件
 */

const Application = require('./src/app')

async function main() {
  try {
    // 创建应用实例
    const app = new Application()

    // 初始化应用
    await app.init()

    // 启动服务器
    app.start()
  } catch (error) {
    console.error('启动失败:', error)
    process.exit(1)
  }
}

// 启动应用
main()
