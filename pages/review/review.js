const app = getApp();
const { api } = require('../../utils/api');

Page({
  data: {
    // 学习报告列表
    reports: [],
    // 加载状态
    loading: false,
    // 空状态
    isEmpty: false
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    // 刷新学习报告
    this.loadReports();
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadData() {
    this.setData({ loading: true });
    await this.loadReports();
    this.setData({ loading: false });
  },

  // 加载学习报告
  async loadReports() {
    try {
      // Fetch conversation history from backend
      const response = await api.history.getConversations(20, 0);

      if (response && response.conversations) {
        // Map backend data to display format
        const reports = response.conversations.map(conv => ({
          id: conv.id,
          date: this.formatBackendDate(conv.date),
          scenario: this.formatScenarioName(conv.scenario),
          duration: conv.duration || 0,
          scores: {
            grammar: conv.overall_score || 0,
            fluency: conv.overall_score || 0
          },
          overallScore: conv.overall_score || 0,
          turns: conv.turns || 0,
          maxTurns: conv.max_turns || 0,
          tips: []
        }));

        this.setData({
          reports: reports,
          isEmpty: reports.length === 0
        });
      } else {
        this.setData({
          reports: [],
          isEmpty: true
        });
      }
    } catch (error) {
      console.error('Failed to load reports:', error);
      // Fallback to empty state
      this.setData({
        reports: [],
        isEmpty: true
      });
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    }
  },

  // Format backend date to display format
  formatBackendDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  },

  // Format scenario name for display
  formatScenarioName(scenario) {
    const nameMap = {
      'job_interview': 'Job Interview',
      'hotel_checkin': 'Hotel Check-in',
      'salary_negotiation': 'Salary Negotiation',
      'renting': 'Renting Apartment'
    };
    return nameMap[scenario] || scenario.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  },

  // 查看报告详情
  viewReport(e) {
    const { id } = e.currentTarget.dataset;
    const report = this.data.reports.find(r => r.id === id);
    if (report) {
      wx.navigateTo({
        url: `/pages/history-detail/history-detail?id=${id}`
      });
    }
  },

  // 分享报告
  shareReport(e) {
    const { id } = e.currentTarget.dataset;
    // 可以生成分享图片或跳转分享页
    wx.showToast({ title: '分享功能开发中', icon: 'none' });
  },

  // 获取分数颜色
  getScoreColor(score) {
    if (score >= 90) return '#52C41A';
    if (score >= 70) return '#FAAD14';
    return '#FF4D4F';
  },

  // 格式化日期
  formatDate(dateStr) {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}月${date.getDate()}日`;
  }
});
