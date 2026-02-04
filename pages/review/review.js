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
          // 优先使用 scenario_title，否则格式化 scenario
          scenario: conv.scenario_title || this.formatScenarioName(conv.scenario),
          duration: conv.duration || 0,
          durationSeconds: conv.duration_seconds || 0,
          scores: {
            grammar: conv.grammar_score || 0,
            fluency: conv.fluency_score || 0,
            vocabulary: conv.vocabulary_score || 0,
            taskCompletion: conv.task_completion_score || 0
          },
          overallScore: conv.overall_score || 0,
          turns: conv.turns || 0,
          maxTurns: conv.max_turns || 0,
          evaluationSummary: conv.evaluation_summary || '',
          status: conv.status
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
    if (!scenario) return '对话练习';
    const nameMap = {
      'job_interview': '求职面试',
      'hotel_checkin': '酒店入住',
      'salary_negotiation': '薪资谈判',
      'renting': '租房咨询'
    };
    // 如果是自定义场景 (custom_xxx)，返回通用名称
    if (scenario.startsWith('custom_')) {
      return '自定义场景';
    }
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

  // 删除报告
  deleteReport(e) {
    const { id } = e.currentTarget.dataset;
    const report = this.data.reports.find(r => r.id === id);
    if (!report) return;

    wx.showModal({
      title: '确认删除',
      content: `确定要删除"${report.scenario}"的对话记录吗？删除后无法恢复。`,
      confirmText: '删除',
      confirmColor: '#FF4D4F',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' });
            await api.history.deleteConversation(id);
            wx.hideLoading();
            wx.showToast({
              title: '删除成功',
              icon: 'success'
            });
            // 刷新列表
            this.loadReports();
          } catch (error) {
            wx.hideLoading();
            console.error('Failed to delete report:', error);
            wx.showToast({
              title: '删除失败',
              icon: 'none'
            });
          }
        }
      }
    });
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
  },

  // 格式化时长
  formatDuration(seconds) {
    if (!seconds) return '0分钟';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 1) return '不到1分钟';
    return `${minutes}分钟`;
  }
});
