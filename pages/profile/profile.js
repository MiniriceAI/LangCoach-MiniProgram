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
    // 缓存大小
    cacheSize: '0 KB',
    // 选择器显示状态
    showLevelPicker: false,
    showTurnsPicker: false,
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
    // 成就列表
    achievements: [
      { id: 'first_chat', name: '初次对话', icon: '💬', unlocked: true },
      { id: 'streak_7', name: '连续7天', icon: '🔥', unlocked: false },
      { id: 'words_100', name: '百词斩', icon: '📚', unlocked: false },
      { id: 'perfect_score', name: '满分达人', icon: '⭐', unlocked: false },
      { id: 'early_bird', name: '早起鸟', icon: '🌅', unlocked: false }
    ]
  },

  onLoad() {
    this.loadUserInfo();
    this.loadSettings();
    this.loadStats();
    this.calculateCacheSize();
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
      autoPlayAudio: wx.getStorageSync('autoPlayAudio') !== false,
      enableReminder: wx.getStorageSync('enableReminder') === true
    });
  },

  // 加载统计数据
  loadStats() {
    const stats = app.globalData.stats;
    this.setData({
      stats: stats
    });
  },

  // 计算缓存大小
  calculateCacheSize() {
    wx.getStorageInfo({
      success: (res) => {
        const sizeKB = res.currentSize;
        let sizeStr = '';
        if (sizeKB < 1024) {
          sizeStr = `${sizeKB} KB`;
        } else {
          sizeStr = `${(sizeKB / 1024).toFixed(1)} MB`;
        }
        this.setData({ cacheSize: sizeStr });
      }
    });
  },

  // 登录
  handleLogin() {
    wx.getUserProfile({
      desc: '用于完善用户资料',
      success: (res) => {
        const userInfo = res.userInfo;
        this.setData({ userInfo });
        wx.setStorageSync('userInfo', userInfo);
        app.globalData.userInfo = userInfo;

        // 调用后端登录
        app.login().catch(console.error);
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

  // 切换自动播放
  toggleAutoPlay(e) {
    const value = e.detail.value;
    this.setData({ autoPlayAudio: value });
    wx.setStorageSync('autoPlayAudio', value);
  },

  // 切换学习提醒
  toggleReminder(e) {
    const value = e.detail.value;
    if (value) {
      wx.requestSubscribeMessage({
        tmplIds: ['your-template-id'],
        success: () => {
          this.setData({ enableReminder: true });
          wx.setStorageSync('enableReminder', true);
        },
        fail: () => {
          this.setData({ enableReminder: false });
          wx.showToast({ title: '需要授权通知权限', icon: 'none' });
        }
      });
    } else {
      this.setData({ enableReminder: false });
      wx.setStorageSync('enableReminder', false);
    }
  },

  // 清除缓存
  clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除所有缓存数据吗？这不会删除你的学习记录。',
      success: (res) => {
        if (res.confirm) {
          // 保留重要数据
          const userInfo = wx.getStorageSync('userInfo');
          const token = wx.getStorageSync('token');
          const stats = wx.getStorageSync('stats');
          const settings = wx.getStorageSync('settings');

          wx.clearStorageSync();

          // 恢复重要数据
          if (userInfo) wx.setStorageSync('userInfo', userInfo);
          if (token) wx.setStorageSync('token', token);
          if (stats) wx.setStorageSync('stats', stats);
          if (settings) wx.setStorageSync('settings', settings);

          this.calculateCacheSize();
          wx.showToast({ title: '清除成功', icon: 'success' });
        }
      }
    });
  },

  // 查看所有成就
  viewAllAchievements() {
    wx.showToast({ title: '功能开发中', icon: 'none' });
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
