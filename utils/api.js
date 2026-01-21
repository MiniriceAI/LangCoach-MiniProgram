/**
 * API 请求封装
 */

const app = getApp();

const BASE_URL = 'https://7lkzpnb7pui8rb-8600.proxy.runpod.net';

/**
 * 通用请求方法
 * @param {string} url - 请求路径
 * @param {object} options - 请求选项
 * @returns {Promise}
 */
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const token = app?.globalData?.sessionId || wx.getStorageSync('token');

    wx.request({
      url: `${BASE_URL}${url}`,
      method: options.method || 'GET',
      data: options.data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.header
      },
      timeout: options.timeout || 30000,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          // Token 过期，尝试重新登录
          handleUnauthorized();
          reject(new Error('登录已过期，请重新登录'));
        } else {
          reject(new Error(res.data?.message || `请求失败: ${res.statusCode}`));
        }
      },
      fail: (err) => {
        console.error('请求失败:', err);
        reject(new Error(err.errMsg || '网络请求失败'));
      }
    });
  });
}

/**
 * 处理未授权
 */
function handleUnauthorized() {
  wx.removeStorageSync('token');
  if (app?.globalData) {
    app.globalData.sessionId = null;
  }
  wx.showToast({
    title: '请重新登录',
    icon: 'none'
  });
}

/**
 * 上传文件
 * @param {string} url - 上传路径
 * @param {string} filePath - 文件路径
 * @param {object} options - 其他选项
 * @returns {Promise}
 */
function uploadFile(url, filePath, options = {}) {
  return new Promise((resolve, reject) => {
    const token = app?.globalData?.sessionId || wx.getStorageSync('token');

    wx.uploadFile({
      url: `${BASE_URL}${url}`,
      filePath: filePath,
      name: options.name || 'file',
      formData: options.formData || {},
      header: {
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.header
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            const data = JSON.parse(res.data);
            resolve(data);
          } catch (e) {
            resolve(res.data);
          }
        } else {
          reject(new Error(`上传失败: ${res.statusCode}`));
        }
      },
      fail: (err) => {
        console.error('上传失败:', err);
        reject(new Error(err.errMsg || '文件上传失败'));
      }
    });
  });
}

// API 方法集合
const api = {
  // 认证相关
  auth: {
    login: (code) => request('/api/auth/wechat', { method: 'POST', data: { code } }),
    logout: () => request('/api/auth/logout', { method: 'POST' })
  },

  // 对话相关
  chat: {
    start: (data) => request('/api/chat/start', { method: 'POST', data }),
    message: (data) => request('/api/chat/message', { method: 'POST', data }),
    rate: (data) => request('/api/chat/rate', { method: 'POST', data }),
    feedback: (data) => request('/api/chat/feedback', { method: 'POST', data })
  },

  // 语音相关
  speech: {
    transcribe: (filePath, sessionId) => uploadFile('/api/transcribe', filePath, {
      name: 'audio',
      formData: { session_id: sessionId }
    }),
    synthesize: (text) => request('/api/synthesize', { method: 'POST', data: { text } })
  },

  // 学习报告
  reports: {
    list: () => request('/api/reports'),
    detail: (id) => request(`/api/reports/${id}`)
  },

  // 词典
  dictionary: {
    lookup: (word) => request('/api/dictionary', { data: { word } })
  },

  // 用户相关
  user: {
    profile: () => request('/api/user/profile'),
    updateSettings: (data) => request('/api/user/settings', { method: 'PUT', data }),
    stats: () => request('/api/user/stats')
  }
};

module.exports = {
  request,
  uploadFile,
  api,
  BASE_URL
};
