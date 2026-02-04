const app = getApp();
const { SCENARIOS, CATEGORIES, QUICK_SCENARIOS, ScenarioUtils } = require('../../utils/scenarios');
const { api } = require('../../utils/api');

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
    expandedCategory: null,
    // 自定义场景相关
    showCustomInputModal: false,
    showScenarioPreviewModal: false,
    customScenarioInput: '',
    scenarioPreview: null,
    isExtractingScenario: false,
    generatedScenarioId: null,
    generatedGreeting: null,
    generatedAudioUrl: null,
    // 防抖标识
    isNavigating: false
  },

  // 随机场景示例
  randomScenarioExamples: [
    '小学三年级学生，去超市买文具',
    '大学生在咖啡店点单',
    '游客在机场问路',
    '求职者参加英语面试',
    '顾客在餐厅投诉菜品',
    '租客和房东讨论租金',
    '病人向医生描述症状',
    '学生向老师请假',
    '顾客在商场退换商品',
    '旅客在酒店办理入住'
  ],

  onLoad() {
    this.loadUserData();
    this.loadCategories();
    this.generateDailyChallenge();
  },

  onShow() {
    this.refreshStats();
    // 重置导航状态，防止异常状态锁定
    this.setData({ isNavigating: false });
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

  // 随机场景（快速开始区域的随机挑战按钮）
  async startRandomScenario() {
    wx.showLoading({ title: '生成场景中...' });

    try {
      // 调用API生成随机场景描述
      const result = await api.customScenario.random();

      wx.hideLoading();

      // 显示自定义场景弹窗，并填充生成的场景描述
      this.setData({
        showCustomInputModal: true,
        customScenarioInput: result.scenario_description
      });

      wx.showToast({
        title: '场景已生成，可编辑',
        icon: 'success',
        duration: 2000
      });

    } catch (error) {
      wx.hideLoading();
      console.error('生成随机场景失败:', error);
      wx.showToast({
        title: '生成失败，请重试',
        icon: 'none'
      });
    }
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
    // 防抖：如果正在导航，忽略后续点击
    if (this.data.isNavigating) {
      console.log('正在导航中，忽略重复点击');
      return;
    }

    // 设置导航状态
    this.setData({ isNavigating: true });

    // 保存场景配置
    app.globalData.settings.scenario = params;
    
    console.log('场景数据已保存:', params);
    
    // 使用setTimeout确保数据保存完成后再跳转
    setTimeout(() => {
      wx.switchTab({
        url: '/pages/chat/chat',
        success: () => {
          console.log('成功跳转到对话页面');
          this.setData({ isNavigating: false });
        },
        fail: (error) => {
          console.error('跳转到对话页面失败:', error);
          // 再次重试
          setTimeout(() => {
            wx.switchTab({
              url: '/pages/chat/chat',
              success: () => {
                console.log('重试跳转成功');
                this.setData({ isNavigating: false });
              },
              fail: () => {
                wx.showToast({
                  title: '跳转失败，请重试',
                  icon: 'none'
                });
                this.setData({ isNavigating: false });
              }
            });
          }, 200);
        }
      });
    }, 50);
  },

  // 查看更多场景
  viewAllScenarios(e) {
    const { category } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/scenarios/scenarios?category=${category}`
    });
  },

  // ========== 自定义场景相关方法 ==========

  // 显示自定义场景输入弹窗
  showCustomScenarioModal() {
    this.setData({
      showCustomInputModal: true,
      customScenarioInput: ''
    });
  },

  // 隐藏自定义场景输入弹窗
  hideCustomInputModal() {
    this.setData({
      showCustomInputModal: false,
      customScenarioInput: ''
    });
  },

  // 自定义场景输入变化
  onCustomInputChange(e) {
    this.setData({
      customScenarioInput: e.detail.value
    });
  },

  // 生成随机场景（弹窗中的随机按钮）
  async generateRandomScenario() {
    wx.showLoading({ title: '生成场景中...' });

    try {
      // 调用API生成随机场景描述
      const result = await api.customScenario.random();

      wx.hideLoading();

      // 填充到输入框中，让用户可以编辑
      this.setData({
        customScenarioInput: result.scenario_description
      });

      wx.showToast({
        title: '场景已生成',
        icon: 'success',
        duration: 1500
      });

    } catch (error) {
      wx.hideLoading();
      console.error('生成随机场景失败:', error);
      wx.showToast({
        title: '生成失败，请重试',
        icon: 'none'
      });
    }
  },

  // 提交自定义场景
  async submitCustomScenario() {
    const input = this.data.customScenarioInput.trim();
    if (!input) {
      wx.showToast({ title: '请输入场景描述', icon: 'none' });
      return;
    }

    // 隐藏输入弹窗，显示预览弹窗
    this.setData({
      showCustomInputModal: false,
      showScenarioPreviewModal: true,
      isExtractingScenario: true
    });

    try {
      // 调用API提取场景信息
      const scenarioInfo = await api.customScenario.extract(input);

      this.setData({
        scenarioPreview: scenarioInfo,
        isExtractingScenario: false
      });

      // 生成场景prompt
      const generateResult = await api.customScenario.generate(scenarioInfo, input);

      this.setData({
        generatedScenarioId: generateResult.scenario_id,
        generatedGreeting: generateResult.greeting,
        generatedAudioUrl: generateResult.audio_url
      });

    } catch (error) {
      console.error('提取场景信息失败:', error);
      this.setData({
        isExtractingScenario: false,
        showScenarioPreviewModal: false
      });
      wx.showToast({ title: '场景分析失败，请重试', icon: 'none' });
    }
  },

  // 隐藏场景预览弹窗
  hideScenarioPreviewModal() {
    this.setData({
      showScenarioPreviewModal: false,
      scenarioPreview: null,
      generatedScenarioId: null,
      generatedGreeting: null,
      generatedAudioUrl: null
    });
  },

  // 开始自定义场景对话
  startCustomScenarioChat() {
    // 防抖：如果正在导航，忽略后续点击
    if (this.data.isNavigating) {
      console.log('正在导航中，忽略重复点击');
      return;
    }

    const { generatedScenarioId, generatedGreeting, generatedAudioUrl, scenarioPreview, customScenarioInput } = this.data;

    if (!generatedScenarioId) {
      wx.showToast({ title: '场景生成中，请稍候', icon: 'none' });
      return;
    }

    // 设置导航状态
    this.setData({ isNavigating: true });

    // 保存自定义场景配置
    const scenarioData = {
      scenario: generatedScenarioId,
      title: customScenarioInput,
      greeting: generatedGreeting,
      audioUrl: generatedAudioUrl,
      isCustom: true,
      scenarioInfo: scenarioPreview,
      speaking_speed: scenarioPreview.speaking_speed  // 传递语速设置
    };
    
    app.globalData.settings.scenario = scenarioData;
    
    console.log('自定义场景数据已保存:', scenarioData);

    // 隐藏弹窗，并在回调中执行跳转
    this.setData({
      showScenarioPreviewModal: false
    }, () => {
      // 在setData回调中执行跳转，确保状态更新完成
      wx.switchTab({
        url: '/pages/chat/chat',
        success: () => {
          console.log('成功跳转到对话页面');
          // 重置导航状态
          this.setData({ isNavigating: false });
        },
        fail: (error) => {
          console.error('跳转到对话页面失败:', error);
          // 再次重试
          setTimeout(() => {
            wx.switchTab({
              url: '/pages/chat/chat',
              success: () => {
                console.log('重试跳转成功');
                this.setData({ isNavigating: false });
              },
              fail: () => {
                wx.showToast({
                  title: '跳转失败，请重试',
                  icon: 'none'
                });
                this.setData({ isNavigating: false });
              }
            });
          }, 200);
        }
      });
    });
  }
});
