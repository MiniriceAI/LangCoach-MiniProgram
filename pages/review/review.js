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
    // 直接使用本地数据，API端点暂未实现
    const localReports = wx.getStorageSync('reports') || [];
    this.setData({
      reports: localReports.length ? localReports : this.getMockReports(),
      isEmpty: !localReports.length
    });
  },

  // 模拟报告数据
  getMockReports() {
    return [
      {
        id: '1',
        date: '2024-01-15',
        scenario: 'Job Interview',
        duration: 8,
        scores: {
          grammar: 85,
          fluency: 82
        },
        overallScore: 84,
        tips: ['尝试使用更复杂的句式', '回答更加自信！']
      },
      {
        id: '2',
        date: '2024-01-14',
        scenario: 'Hotel Checkin',
        duration: 15,
        scores: {
          grammar: 90,
          fluency: 88
        },
        overallScore: 89,
        tips: ['回答更加自信了', '注意时态的一致性']
      }
    ];
  },

  // 查看报告详情
  viewReport(e) {
    const { id } = e.currentTarget.dataset;
    const report = this.data.reports.find(r => r.id === id);
    if (report) {
      wx.navigateTo({
        url: `/pages/report-detail/report-detail?id=${id}`
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
