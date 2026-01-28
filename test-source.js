/**
 * 示例自定义源
 * @name 测试音源
 * @version 1.0.0
 * @author Test Author
 * @description 用于测试的示例音源
 * @homepage https://example.com
 */

// 注册搜索方法
globalThis.search = async (params) => {
  const { keyword, page = 1, limit = 30 } = params
  
  console.log(`搜索: ${keyword}, 页码: ${page}`)
  
  // 这里应该实现真实的搜索逻辑
  // 以下是示例返回数据
  return [
    {
      id: '1001',
      name: '示例歌曲1',
      singer: '示例歌手',
      album: '示例专辑',
      duration: 240,
      source: 'test'
    },
    {
      id: '1002',
      name: '示例歌曲2',
      singer: '示例歌手',
      album: '示例专辑',
      duration: 210,
      source: 'test'
    }
  ]
}

// 注册获取播放链接方法
globalThis.getUrl = async (params) => {
  const { songInfo, quality } = params
  
  console.log(`获取播放链接: ${songInfo.name}, 质量: ${quality}`)
  
  // 这里应该实现真实的获取播放链接逻辑
  // 返回一个示例 URL (这是一个公开的测试音频)
  return 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3'
}

// 注册获取歌词方法 (可选)
globalThis.getLyric = async (params) => {
  const { songInfo } = params
  
  console.log(`获取歌词: ${songInfo.name}`)
  
  // 返回 LRC 格式歌词
  return `[00:00.00]示例歌词
[00:05.00]这是一首测试歌曲
[00:10.00]用于演示自定义源功能
[00:15.00]可以播放、下载音乐`
}

// 注册获取榜单方法 (可选)
globalThis.getLeaderboard = async () => {
  return [
    {
      id: 'hot',
      name: '热歌榜',
      description: '最热门的歌曲'
    },
    {
      id: 'new',
      name: '新歌榜',
      description: '最新发布的歌曲'
    }
  ]
}

console.log('测试音源已加载')
