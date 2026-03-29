const { api } = require('./utils/api');

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
      voice: 'Ceylia',  // 语音角色: Ceylia, Tifa, David, Tony, Emma, Ryan, Sarah, William
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

  async checkLoginStatus() {
    const token = wx.getStorageSync('authToken');
    if (token) {
      this.globalData.sessionId = token;
      // Validate token by fetching user profile
      try {
        const userInfo = await api.auth.getUserProfile();
        this.globalData.userInfo = userInfo;
        wx.setStorageSync('userInfo', userInfo);
      } catch (error) {
        console.error('Token validation failed:', error);
        // Clear invalid token
        wx.removeStorageSync('authToken');
        this.globalData.sessionId = null;
        this.globalData.userInfo = null;
      }
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
  async login(userProfile = null) {
    return new Promise((resolve, reject) => {
      wx.login({
        success: async (res) => {
          if (res.code) {
            try {
              // Prepare login request with optional user profile
              const loginData = {
                code: res.code,
                nickname: userProfile?.nickName,
                avatar_url: userProfile?.avatarUrl
              };

              // Send code to backend to exchange for JWT token
              const response = await api.auth.wechatLogin(loginData);

              if (response && response.token) {
                // Store JWT token
                this.globalData.sessionId = response.token;
                wx.setStorageSync('authToken', response.token);

                // Store user info
                if (response.user) {
                  this.globalData.userInfo = response.user;
                  wx.setStorageSync('userInfo', response.user);
                }

                resolve(response);
              } else {
                reject(new Error('登录失败'));
              }
            } catch (error) {
              console.error('Login error:', error);
              reject(error);
            }
          } else {
            reject(new Error('获取登录凭证失败'));
          }
        },
        fail: reject
      });
    });
  }
});
