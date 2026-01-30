const app = getApp();

Page({
  data: {
    // 用户信息
    userInfo: null,
    // 统计数据
    stats: {
      totalMinutes: 0,
      totalSessions: 0,
      currentStreak: 0
    },
    // 当前设置
    currentLevel: 'B1',
    currentTurns: 20,
    autoPlayAudio: true,
    enableReminder: false,
    currentVoice: 'Ceylia',  // 当前选择的语音
    // 缓存大小
    cacheSize: '0 KB',
    // 选择器显示状态
    showLevelPicker: false,
    showTurnsPicker: false,
    showVoicePicker: false,
    // 难度选项
    levelOptions: [
      { code: 'A1', name: '入门级' },
      { code: 'A2', name: '基础级' },
      { code: 'B1', name: '中级' },
      { code: 'B2', name: '中高级' },
      { code: 'C1', name: '高级' },
      { code: 'C2', name: '精通级' }
    ],
    // 轮数选项
    turnsOptions: [
      { value: 10, name: '快速练习' },
      { value: 20, name: '标准练习' },
      { value: 30, name: '深度练习' },
      { value: 50, name: '长对话' }
    ],
    // 语音选项
    voiceOptions: [
      { code: 'Ceylia', name: 'Ceylia', desc: '美式女声 - 友好' },
      { code: 'Tifa', name: 'Tifa', desc: '美式女声 - 自然' },
      { code: 'David', name: 'David', desc: '美式男声 - 温和' },
      { code: 'Tony', name: 'Tony', desc: '美式男声 - 成熟' },
      { code: 'Emma', name: 'Emma', desc: '英式女声 - 优雅' },
      { code: 'Ryan', name: 'Ryan', desc: '英式男声 - 正式' },
      { code: 'Sarah', name: 'Sarah', desc: '澳式女声 - 活泼' },
      { code: 'William', name: 'William', desc: '澳式男声 - 友好' }
    ]
  },

  onLoad() {
    this.loadUserInfo();
    this.loadSettings();
    this.loadStats();
  },

  onShow() {
    this.loadStats();
  },

  // 加载用户信息
  loadUserInfo() {
    const userInfo = wx.getStorageSync('userInfo');
    if (userInfo) {
      this.setData({ userInfo });
    }
  },

  // 加载设置
  loadSettings() {
    const settings = app.globalData.settings;
    this.setData({
      currentLevel: settings.level || 'B1',
      currentTurns: settings.turns || 20,
      currentVoice: settings.voice || 'Ceylia'
    });
  },

  // 加载统计数据
  loadStats() {
    const stats = app.globalData.stats;
    this.setData({
      stats: stats
    });
  },

  // 登录
  handleLogin() {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: async (res) => {
        const userInfo = res.userInfo;
        this.setData({ userInfo });
        wx.setStorageSync('userInfo', userInfo);
        app.globalData.userInfo = userInfo;

        // 调用后端登录，传递用户信息
        try {
          await app.login(userInfo);
          wx.showToast({ title: '登录成功', icon: 'success' });
        } catch (error) {
          console.error('Login failed:', error);
          wx.showToast({ title: '登录失败', icon: 'none' });
        }
      },
      fail: () => {
        wx.showToast({ title: '登录取消', icon: 'none' });
      }
    });
  },

  // 显示难度选择器
  showLevelSelector() {
    this.setData({ showLevelPicker: true });
  },

  // 隐藏难度选择器
  hideLevelSelector() {
    this.setData({ showLevelPicker: false });
  },

  // 选择难度
  selectLevel(e) {
    const level = e.currentTarget.dataset.level;
    this.setData({
      currentLevel: level,
      showLevelPicker: false
    });
    app.saveSettings({ level });
    wx.showToast({ title: '已更新', icon: 'success' });
  },

  // 显示轮数选择器
  showTurnsSelector() {
    this.setData({ showTurnsPicker: true });
  },

  // 隐藏轮数选择器
  hideTurnsSelector() {
    this.setData({ showTurnsPicker: false });
  },

  // 选择轮数
  selectTurns(e) {
    const turns = e.currentTarget.dataset.turns;
    this.setData({
      currentTurns: turns,
      showTurnsPicker: false
    });
    app.saveSettings({ turns });
    wx.showToast({ title: '已更新', icon: 'success' });
  },

  // 显示语音选择器
  showVoiceSelector() {
    this.setData({ showVoicePicker: true });
  },

  // 隐藏语音选择器
  hideVoiceSelector() {
    this.setData({ showVoicePicker: false });
  },

  // 选择语音
  selectVoice(e) {
    const voice = e.currentTarget.dataset.voice;
    this.setData({
      currentVoice: voice,
      showVoicePicker: false
    });
    app.saveSettings({ voice });
    wx.showToast({ title: '语音已更新', icon: 'success' });
  },

  // 关于页面
  showAbout() {
    wx.showModal({
      title: '关于 LangCoach',
      content: 'LangCoach 是一款 AI 驱动的语言学习助手，通过模拟真实场景对话，帮助你提升英语口语能力。\n\n版本：1.0.0',
      showCancel: false
    });
  },

  // 意见反馈
  showFeedback() {
    wx.navigateTo({
      url: '/pages/feedback/feedback'
    });
  },

  // 分享
  onShareAppMessage() {
    return {
      title: 'LangCoach - AI英语口语练习',
      path: '/pages/home/home',
      imageUrl: '/images/share-cover.png'
    };
  }
});
