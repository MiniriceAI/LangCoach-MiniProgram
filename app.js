App({
  globalData: {
    userInfo: null,
    sessionId: null,
    // API 基础地址 - 与 utils/api.js 中的 BASE_URL 保持一致
    baseUrl: 'https://www.minirice.xyz',
    // 会话配置
    settings: {
      turns: 20,        // 对话轮数: 10, 20, 30, 50
      level: 'B1',      // 难度等级: A1, A2, B1, B2, C1, C2
      scenario: null    // 当前场景
    },
    // 学习统计
    stats: {
      totalMinutes: 0,
      totalSessions: 0,
      currentStreak: 0,
      wordsLearned: 0
    }
  },

  onLaunch() {
    // 检查登录状态
    this.checkLoginStatus();
    // 加载本地存储的设置
    this.loadSettings();
    // 加载统计数据
    this.loadStats();
  },

  checkLoginStatus() {
    const token = wx.getStorageSync('token');
    if (token) {
      this.globalData.sessionId = token;
    }
  },

  loadSettings() {
    const settings = wx.getStorageSync('settings');
    if (settings) {
      this.globalData.settings = { ...this.globalData.settings, ...settings };
    }
  },

  saveSettings(settings) {
    this.globalData.settings = { ...this.globalData.settings, ...settings };
    wx.setStorageSync('settings', this.globalData.settings);
  },

  loadStats() {
    const stats = wx.getStorageSync('stats');
    if (stats) {
      this.globalData.stats = { ...this.globalData.stats, ...stats };
    }
  },

  updateStats(newStats) {
    this.globalData.stats = { ...this.globalData.stats, ...newStats };
    wx.setStorageSync('stats', this.globalData.stats);
  },

  // 微信登录
  async login() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (res) => {
          if (res.code) {
            // 发送 code 到后端换取 session
            wx.request({
              url: `${this.globalData.baseUrl}/api/auth/wechat`,
              method: 'POST',
              data: { code: res.code },
              success: (response) => {
                if (response.data && response.data.token) {
                  this.globalData.sessionId = response.data.token;
                  wx.setStorageSync('token', response.data.token);
                  resolve(response.data);
                } else {
                  reject(new Error('登录失败'));
                }
              },
              fail: reject
            });
          } else {
            reject(new Error('获取登录凭证失败'));
          }
        },
        fail: reject
      });
    });
  }
});
