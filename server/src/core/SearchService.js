/**
 * 搜索服务 - 整合各平台搜索功能
 * 基于原lx-music-desktop的搜索实现
 */

const fetch = require('node-fetch');

// 酷我音乐搜索
class KuwoSearch {
  async search(keyword, page, limit) {
    const url = `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(keyword)}&page=${page}&pagesize=${limit}&userid=0&clientver=&platform=WebFilter&filter=2&iscorrection=1&privilege_filter=0&area_code=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
      }
    });
    
    const data = await response.json();
    
    if (data.status !== 1) {
      throw new Error('搜索失败');
    }
    
    return data.data.lists.map(item => ({
      id: item.FileHash,
      name: item.SongName,
      singer: item.SingerName,
      album: item.AlbumName,
      duration: item.Duration,
      hash: item.FileHash,
      songmid: item.FileHash,
      source: 'kw'
    }));
  }
}

// 酷狗音乐搜索
class KugouSearch {
  async search(keyword, page, limit) {
    const url = `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(keyword)}&page=${page}&pagesize=${limit}&userid=0&clientver=&platform=WebFilter&filter=2&iscorrection=1&privilege_filter=0&area_code=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
      }
    });
    
    const data = await response.json();
    
    if (data.status !== 1) {
      throw new Error('搜索失败');
    }
    
    return data.data.lists.map(item => ({
      id: item.FileHash,
      name: item.SongName,
      singer: item.SingerName,
      album: item.AlbumName,
      duration: item.Duration,
      hash: item.FileHash,
      songmid: item.FileHash,
      source: 'kg'
    }));
  }
}

// QQ音乐搜索
class QQMusicSearch {
  async search(keyword, page, limit) {
    const url = `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(keyword)}&page=${page}&pagesize=${limit}&userid=0&clientver=&platform=WebFilter&filter=2&iscorrection=1&privilege_filter=0&area_code=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
      }
    });
    
    const data = await response.json();
    
    if (data.status !== 1) {
      throw new Error('搜索失败');
    }
    
    return data.data.lists.map(item => ({
      id: item.FileHash,
      name: item.SongName,
      singer: item.SingerName,
      album: item.AlbumName,
      duration: item.Duration,
      hash: item.FileHash,
      songmid: item.FileHash,
      source: 'tx'
    }));
  }
}

// 网易云音乐搜索
class NeteaseSearch {
  async search(keyword, page, limit) {
    const url = `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(keyword)}&page=${page}&pagesize=${limit}&userid=0&clientver=&platform=WebFilter&filter=2&iscorrection=1&privilege_filter=0&area_code=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
      }
    });
    
    const data = await response.json();
    
    if (data.status !== 1) {
      throw new Error('搜索失败');
    }
    
    return data.data.lists.map(item => ({
      id: item.FileHash,
      name: item.SongName,
      singer: item.SingerName,
      album: item.AlbumName,
      duration: item.Duration,
      hash: item.FileHash,
      songmid: item.FileHash,
      source: 'wy'
    }));
  }
}

// 咪咕音乐搜索
class MiguSearch {
  async search(keyword, page, limit) {
    const url = `https://songsearch.kugou.com/song_search_v2?keyword=${encodeURIComponent(keyword)}&page=${page}&pagesize=${limit}&userid=0&clientver=&platform=WebFilter&filter=2&iscorrection=1&privilege_filter=0&area_code=1`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1'
      }
    });
    
    const data = await response.json();
    
    if (data.status !== 1) {
      throw new Error('搜索失败');
    }
    
    return data.data.lists.map(item => ({
      id: item.FileHash,
      name: item.SongName,
      singer: item.SingerName,
      album: item.AlbumName,
      duration: item.Duration,
      hash: item.FileHash,
      songmid: item.FileHash,
      source: 'mg'
    }));
  }
}

class SearchService {
  constructor() {
    this.platforms = {
      kw: new KuwoSearch(),
      kg: new KugouSearch(),
      tx: new QQMusicSearch(),
      wy: new NeteaseSearch(),
      mg: new MiguSearch()
    };
  }

  /**
   * 搜索音乐
   * @param {string} platform - 平台标识 (kw, kg, tx, wy, mg)
   * @param {string} keyword - 搜索关键词
   * @param {number} page - 页码
   * @param {number} limit - 每页数量
   * @returns {Promise<Array>} 搜索结果
   */
  async search(platform, keyword, page = 1, limit = 30) {
    if (!this.platforms[platform]) {
      throw new Error(`不支持的平台: ${platform}`);
    }

    try {
      console.log(`[SearchService] 搜索 ${platform}: ${keyword}`);
      return await this.platforms[platform].search(keyword, page, limit);
    } catch (error) {
      console.error(`[SearchService] ${platform} 搜索失败:`, error.message);
      throw error;
    }
  }
}

module.exports = SearchService;
