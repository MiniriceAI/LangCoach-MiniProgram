/**
 * LangCoach Mini Program API Client
 *
 * 统一的 API 请求封装
 * 服务端地址: 端口 8600
 *
 * API 接口:
 * - /api/chat/start     - 开始对话
 * - /api/chat/message   - 发送消息
 * - /api/chat/rate      - 评价会话
 * - /api/chat/feedback  - 消息反馈
 * - /api/transcribe     - 语音转文字
 * - /api/synthesize     - 文字转语音
 * - /api/scenarios      - 场景列表
 * - /api/auth/wechat    - 微信登录
 */

const app = getApp();

// API 基础地址 - 统一端口 8600
const BASE_URL = 'https://www.minirice.xyz';  // 生产环境
// const BASE_URL = 'http://localhost:8600';  // 本地开发

/**
 * 通用请求方法
 * @param {string} url - 请求路径
 * @param {object} options - 请求选项
 * @returns {Promise}
 */
function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const token = app?.globalData?.sessionId || wx.getStorageSync('authToken');

    wx.request({
      url: `${BASE_URL}${url}`,
      method: options.method || 'GET',
      data: options.data,
      timeout: options.timeout || 60000,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options.header
      },
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else if (res.statusCode === 401) {
          handleUnauthorized();
          reject(new Error('登录已过期，请重新登录'));
        } else {
          reject(new Error(res.data?.detail || res.data?.message || `请求失败: ${res.statusCode}`));
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
  wx.removeStorageSync('authToken');
  wx.removeStorageSync('userInfo');
  if (app?.globalData) {
    app.globalData.sessionId = null;
    app.globalData.userInfo = null;
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
    const token = app?.globalData?.sessionId || wx.getStorageSync('authToken');

    wx.uploadFile({
      url: `${BASE_URL}${url}`,
      filePath: filePath,
      name: options.name || 'file',
      timeout: options.timeout || 120000,
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
  // 健康检查
  health: () => request('/health'),

  // 认证相关
  auth: {
    wechatLogin: (loginData) => request('/api/auth/wechat', {
      method: 'POST',
      data: loginData
    }),
    getUserProfile: () => request('/api/auth/me')
  },

  // 场景相关
  scenarios: {
    list: () => request('/api/scenarios')
  },

  // 自定义场景相关
  customScenario: {
    // 从用户输入提取场景信息
    extract: (userInput) => request('/api/custom-scenario/extract', {
      method: 'POST',
      data: { user_input: userInput },
      timeout: 60000
    }),
    // 生成场景prompt
    generate: (scenarioInfo, userInput) => request('/api/custom-scenario/generate', {
      method: 'POST',
      data: { scenario_info: scenarioInfo, user_input: userInput },
      timeout: 60000
    }),
    // 生成随机场景
    random: () => request('/api/custom-scenario/random', {
      method: 'POST',
      timeout: 60000
    })
  },

  // 对话相关
  chat: {
    start: (data) => request('/api/chat/start', {
      method: 'POST',
      data,
      timeout: 60000
    }),
    message: (data) => request('/api/chat/message', {
      method: 'POST',
      data,
      timeout: 60000
    }),
    end: (sessionId) => request('/api/chat/end', {
      method: 'POST',
      data: { session_id: sessionId },
      timeout: 120000  // 评价生成可能需要较长时间
    }),
    rate: (data) => request('/api/chat/rate', {
      method: 'POST',
      data
    }),
    feedback: (data) => request('/api/chat/feedback', {
      method: 'POST',
      data
    })
  },

  // 语音相关
  speech: {
    transcribe: (filePath, sessionId) => uploadFile('/api/transcribe', filePath, {
      name: 'audio',
      formData: { session_id: sessionId || '' },
      timeout: 120000
    }),
    synthesize: (text, speaker = 'Ceylia', fastMode = true) => request('/api/synthesize', {
      method: 'POST',
      data: { text, speaker, fast_mode: fastMode },
      timeout: 60000
    })
  },

  // TTS 语音角色
  speakers: {
    list: () => request('/api/speakers')
  },

  // 历史记录相关
  history: {
    // 获取对话历史列表
    getConversations: (limit = 20, offset = 0) => request('/api/history/conversations', {
      method: 'GET',
      data: { limit, offset }
    }),
    // 获取对话详情
    getConversationDetail: (conversationId) => request(`/api/history/conversations/${conversationId}`),
    // 删除对话
    deleteConversation: (conversationId) => request(`/api/history/conversations/${conversationId}`, {
      method: 'DELETE'
    })
  }
};

module.exports = {
  request,
  uploadFile,
  api,
  BASE_URL
};
