const app = getApp();
const { api } = require('../../utils/api');

Page({
  data: {
    conversationId: null,
    loading: true,
    // Conversation metadata
    scenario: '',
    date: '',
    duration: 0,
    turns: 0,
    maxTurns: 0,
    rating: null,
    overallScore: null,
    // Custom scenario details
    hasCustomScenario: false,
    customScenario: null,
    // Messages
    messages: [],
    // Greeting
    greeting: ''
  },

  onLoad(options) {
    if (options.id) {
      this.setData({ conversationId: options.id });
      this.loadConversationDetail();
    } else {
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  async loadConversationDetail() {
    this.setData({ loading: true });

    try {
      const detail = await api.history.getConversationDetail(this.data.conversationId);

      if (detail) {
        // Extract greeting from first message
        const greeting = detail.messages && detail.messages.length > 0 && detail.messages[0].role === 'assistant'
          ? detail.messages[0].content
          : '';

        this.setData({
          scenario: this.formatScenarioName(detail.scenario),
          date: this.formatDate(detail.created_at),
          duration: detail.duration || 0,
          turns: detail.current_turn || 0,
          maxTurns: detail.max_turns || 0,
          rating: detail.rating,
          overallScore: detail.overall_score,
          hasCustomScenario: !!detail.custom_scenario,
          customScenario: detail.custom_scenario,
          messages: detail.messages || [],
          greeting: greeting,
          loading: false
        });
      } else {
        throw new Error('对话详情不存在');
      }
    } catch (error) {
      console.error('Failed to load conversation detail:', error);
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
      this.setData({ loading: false });
      setTimeout(() => {
        wx.navigateBack();
      }, 1500);
    }
  },

  formatScenarioName(scenario) {
    const nameMap = {
      'job_interview': '面试场景',
      'hotel_checkin': '酒店入住',
      'salary_negotiation': '薪资谈判',
      'renting': '租房场景'
    };
    return nameMap[scenario] || scenario.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  },

  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours().toString().padStart(2, '0');
    const minute = date.getMinutes().toString().padStart(2, '0');
    return `${year}年${month}月${day}日 ${hour}:${minute}`;
  },

  getScoreColor(score) {
    if (!score) return '#999';
    if (score >= 90) return '#52C41A';
    if (score >= 70) return '#FAAD14';
    return '#FF4D4F';
  },

  onShareAppMessage() {
    return {
      title: `我在 LangCoach 完成了${this.data.scenario}练习`,
      path: '/pages/home/home'
    };
  }
});
