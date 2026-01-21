const app = getApp();
const { api } = require('../../utils/api');

Page({
  data: {
    // 当前标签
    activeTab: 'reports', // reports | flashcards
    // 学习报告列表
    reports: [],
    // 生词卡片
    flashcards: [],
    // 当前复习的卡片索引
    currentCardIndex: 0,
    // 是否显示答案
    showAnswer: false,
    // 复习模式
    isReviewMode: false,
    // 加载状态
    loading: false,
    // 空状态
    isEmpty: false
  },

  onLoad() {
    this.loadData();
  },

  onShow() {
    // 刷新生词本（可能从对话页添加了新词）
    this.loadFlashcards();
  },

  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh();
    });
  },

  async loadData() {
    this.setData({ loading: true });
    await Promise.all([
      this.loadReports(),
      this.loadFlashcards()
    ]);
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

  // 加载生词卡片
  loadFlashcards() {
    const flashcards = wx.getStorageSync('flashcards') || [];
    this.setData({
      flashcards: flashcards.sort((a, b) => b.addedAt - a.addedAt)
    });
  },

  // 模拟报告数据
  getMockReports() {
    return [
      {
        id: '1',
        date: '2024-01-15',
        scenario: '咖啡店点单',
        duration: 8,
        scores: {
          grammar: 85,
          vocabulary: 78,
          fluency: 82
        },
        overallScore: 82,
        tips: ['尝试使用更复杂的句式', '词汇运用很棒！']
      },
      {
        id: '2',
        date: '2024-01-14',
        scenario: '面试模拟',
        duration: 15,
        scores: {
          grammar: 90,
          vocabulary: 85,
          fluency: 88
        },
        overallScore: 88,
        tips: ['回答更加自信了', '注意时态的一致性']
      }
    ];
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({ activeTab: tab });
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

  // 开始复习生词
  startReview() {
    if (this.data.flashcards.length === 0) {
      wx.showToast({ title: '暂无生词', icon: 'none' });
      return;
    }
    this.setData({
      isReviewMode: true,
      currentCardIndex: 0,
      showAnswer: false
    });
  },

  // 退出复习模式
  exitReview() {
    this.setData({ isReviewMode: false });
  },

  // 翻转卡片
  flipCard() {
    this.setData({ showAnswer: !this.data.showAnswer });
  },

  // 下一张卡片
  nextCard() {
    const { currentCardIndex, flashcards } = this.data;
    if (currentCardIndex < flashcards.length - 1) {
      this.setData({
        currentCardIndex: currentCardIndex + 1,
        showAnswer: false
      });
    } else {
      wx.showModal({
        title: '复习完成',
        content: `你已复习完所有 ${flashcards.length} 个单词！`,
        showCancel: false,
        success: () => {
          this.setData({ isReviewMode: false });
        }
      });
    }
  },

  // 上一张卡片
  prevCard() {
    const { currentCardIndex } = this.data;
    if (currentCardIndex > 0) {
      this.setData({
        currentCardIndex: currentCardIndex - 1,
        showAnswer: false
      });
    }
  },

  // 标记为已掌握
  markAsLearned(e) {
    const { index } = e.currentTarget.dataset;
    const flashcards = [...this.data.flashcards];
    flashcards[index].learned = true;
    flashcards[index].learnedAt = Date.now();

    this.setData({ flashcards });
    wx.setStorageSync('flashcards', flashcards);

    wx.showToast({ title: '已标记掌握', icon: 'success' });
  },

  // 删除生词
  deleteFlashcard(e) {
    const { index } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个单词吗？',
      success: (res) => {
        if (res.confirm) {
          const flashcards = [...this.data.flashcards];
          flashcards.splice(index, 1);
          this.setData({ flashcards });
          wx.setStorageSync('flashcards', flashcards);
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
  }
});
