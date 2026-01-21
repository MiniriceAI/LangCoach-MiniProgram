const app = getApp();
const { SCENARIOS, CATEGORIES, QUICK_SCENARIOS, ScenarioUtils } = require('../../utils/scenarios');

Page({
  data: {
    // 用户信息
    userInfo: null,
    // 每日挑战
    dailyChallenge: null,
    // 学习统计
    stats: {
      streak: 0,
      todayMinutes: 0,
      weeklyGoal: 30,
      weeklyProgress: 0
    },
    // 话题分类
    categories: [],
    // 快速练习场景
    quickScenarios: QUICK_SCENARIOS,
    // 展开的分类
    expandedCategory: null
  },

  onLoad() {
    this.loadUserData();
    this.loadCategories();
    this.generateDailyChallenge();
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

  loadCategories() {
    // 构建分类数据，包含场景信息
    const categories = Object.values(CATEGORIES).map(category => ({
      ...category,
      scenarios: category.scenarios.map(scenarioId => SCENARIOS[scenarioId])
    }));

    this.setData({ categories });
  },

  generateDailyChallenge() {
    // 生成每日挑战（随机选择一个场景）
    const randomScenario = ScenarioUtils.getRandomScenario();
    const dailyChallenge = {
      title: randomScenario.name,
      description: randomScenario.description,
      difficulty: randomScenario.difficulty,
      estimatedTime: randomScenario.estimatedTime,
      completed: false,
      scenario: randomScenario
    };

    this.setData({ dailyChallenge });
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
    if (dailyChallenge && dailyChallenge.scenario) {
      this.navigateToChat({
        scenario: dailyChallenge.scenario.id,
        title: dailyChallenge.scenario.name,
        difficulty: dailyChallenge.scenario.difficulty,
        category: dailyChallenge.scenario.category
      });
    }
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
    
    setTimeout(() => {
      wx.hideLoading();
      const randomScenario = ScenarioUtils.getRandomScenario();
      this.navigateToChat({
        scenario: randomScenario.id,
        title: randomScenario.name,
        difficulty: randomScenario.difficulty,
        category: randomScenario.category
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
