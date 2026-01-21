Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    report: {
      type: Object,
      value: null
    }
  },

  data: {
    rating: 0,
    feedback: ''
  },

  methods: {
    // 设置评分
    setRating(e) {
      const rating = e.currentTarget.dataset.rating;
      this.setData({ rating });
    },

    // 输入反馈
    onFeedbackInput(e) {
      this.setData({ feedback: e.detail.value });
    },

    // 提交评分
    submit() {
      if (this.data.rating === 0) {
        wx.showToast({ title: '请选择评分', icon: 'none' });
        return;
      }
      this.triggerEvent('submit', {
        rating: this.data.rating,
        feedback: this.data.feedback
      });
    },

    // 关闭弹窗
    close() {
      this.triggerEvent('close');
    },

    // 重新开始
    restart() {
      this.triggerEvent('restart');
    },

    // 阻止冒泡
    stopPropagation() {}
  }
});
