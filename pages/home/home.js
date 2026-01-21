const app = getApp();

Page({
  data: {
    // 用户信息
    userInfo: null,
    // 每日挑战
    dailyChallenge: {
      title: '咖啡店点单',
      description: '练习在咖啡店用英语点一杯咖啡',
      difficulty: 'B1',
      estimatedTime: 5,
      completed: false
    },
    // 学习统计
    stats: {
      streak: 0,
      todayMinutes: 0,
      weeklyGoal: 30,
      weeklyProgress: 0
    },
    // 话题分类
    categories: [
      {
        id: 'business',
        name: '商务英语',
        icon: '💼',
        color: '#4A90D9',
        scenarios: [
          { id: 'interview', name: '面试模拟', difficulty: 'B2' },
          { id: 'meeting', name: '会议讨论', difficulty: 'B2' },
          { id: 'presentation', name: '演讲汇报', difficulty: 'C1' },
          { id: 'negotiation', name: '商务谈判', difficulty: 'C1' }
        ]
      },
      {
        id: 'travel',
        name: '旅行英语',
        icon: '✈️',
        color: '#52C41A',
        scenarios: [
          { id: 'airport', name: '机场通关', difficulty: 'A2' },
          { id: 'hotel', name: '酒店入住', difficulty: 'A2' },
          { id: 'restaurant', name: '餐厅点餐', difficulty: 'B1' },
          { id: 'directions', name: '问路导航', difficulty: 'A2' }
        ]
      },
      {
        id: 'social',
        name: '社交英语',
        icon: '💬',
        color: '#FAAD14',
        scenarios: [
          { id: 'introduction', name: '自我介绍', difficulty: 'A1' },
          { id: 'smalltalk', name: '闲聊寒暄', difficulty: 'B1' },
          { id: 'party', name: '派对社交', difficulty: 'B1' },
          { id: 'dating', name: '约会交友', difficulty: 'B2' }
        ]
      },
      {
        id: 'daily',
        name: '日常生活',
        icon: '🏠',
        color: '#FF6B6B',
        scenarios: [
          { id: 'shopping', name: '购物砍价', difficulty: 'A2' },
          { id: 'doctor', name: '看病就医', difficulty: 'B1' },
          { id: 'bank', name: '银行业务', difficulty: 'B1' },
          { id: 'complaint', name: '投诉维权', difficulty: 'B2' }
        ]
      }
    ],
    // 快速练习场景
    quickScenarios: [
      { id: 'random', name: '随机挑战', icon: '🎲', color: '#9B59B6' },
      { id: 'roleplay', name: '角色互换', icon: '🔄', color: '#3498DB' }
    ],
    // 展开的分类
    expandedCategory: null
  },

  onLoad() {
    this.loadUserData();
  },

  onShow() {
    this.refreshStats();
  },

  loadUserData() {
    const userInfo = app.globalData.userInfo;
    const stats = app.globalData.stats;
    this.setData({
      userInfo,
      'stats.streak': stats.currentStreak,
      'stats.todayMinutes': stats.totalMinutes % 60
    });
  },

  refreshStats() {
    const stats = app.globalData.stats;
    this.setData({
      'stats.streak': stats.currentStreak,
      'stats.weeklyProgress': Math.min((stats.totalMinutes / this.data.stats.weeklyGoal) * 100, 100)
    });
  },

  // 开始每日挑战
  startDailyChallenge() {
    const { dailyChallenge } = this.data;
    this.navigateToChat({
      scenario: 'daily_challenge',
      title: dailyChallenge.title,
      difficulty: dailyChallenge.difficulty
    });
  },

  // 快速练习
  startQuickPractice(e) {
    const { id } = e.currentTarget.dataset;
    if (id === 'random') {
      this.startRandomScenario();
    } else if (id === 'roleplay') {
      this.startRoleReversal();
    }
  },

  // 随机场景
  startRandomScenario() {
    wx.showLoading({ title: '生成场景中...' });
    // 模拟随机生成场景
    setTimeout(() => {
      wx.hideLoading();
      this.navigateToChat({
        scenario: 'random',
        title: '随机挑战',
        difficulty: app.globalData.settings.level
      });
    }, 500);
  },

  // 角色互换模式
  startRoleReversal() {
    this.navigateToChat({
      scenario: 'roleplay',
      title: '角色互换',
      difficulty: app.globalData.settings.level,
      roleReversed: true
    });
  },

  // 展开/收起分类
  toggleCategory(e) {
    const { id } = e.currentTarget.dataset;
    this.setData({
      expandedCategory: this.data.expandedCategory === id ? null : id
    });
  },

  // 选择场景
  selectScenario(e) {
    const { category, scenario } = e.currentTarget.dataset;
    const categoryData = this.data.categories.find(c => c.id === category);
    const scenarioData = categoryData.scenarios.find(s => s.id === scenario);

    this.navigateToChat({
      scenario: scenario,
      title: scenarioData.name,
      difficulty: scenarioData.difficulty,
      category: category
    });
  },

  // 跳转到对话页
  navigateToChat(params) {
    // 保存场景配置
    app.globalData.settings.scenario = params;
    wx.switchTab({
      url: '/pages/chat/chat'
    });
  },

  // 查看更多场景
  viewAllScenarios(e) {
    const { category } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/scenarios/scenarios?category=${category}`
    });
  }
});
