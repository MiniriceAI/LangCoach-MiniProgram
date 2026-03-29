const app = getApp();
const { api } = require('../../utils/api');

Page({
  data: {
    conversationId: null,
    loading: true,
    // Conversation metadata
    scenario: '',
    scenarioTitle: '',
    date: '',
    duration: 0,
    durationSeconds: 0,
    durationDisplay: '', // Computed duration display string
    durationMinutes: '-', // Computed duration in minutes for stats
    turns: 0,
    maxTurns: 0,
    rating: null,
    overallScore: null,
    grammarScore: null,
    fluencyScore: null,
    vocabularyScore: null,
    taskCompletionScore: null,
    // Evaluation
    evaluationStrengths: '',
    evaluationImprovements: '',
    evaluationSummary: '',
    // Custom scenario details
    hasCustomScenario: false,
    customScenario: null,
    // Messages
    messages: [],
    // Greeting (first assistant message)
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

        // Compute duration display
        const durationSeconds = detail.duration_seconds || 0;
        const duration = detail.duration || 0;
        let durationDisplay = '';
        if (durationSeconds > 0) {
          if (durationSeconds >= 60) {
            durationDisplay = Math.floor(durationSeconds / 60) + '分钟';
          } else {
            durationDisplay = '不到1分钟';
          }
        } else if (duration > 0) {
          durationDisplay = duration + '分钟';
        } else {
          durationDisplay = '-';
        }

        // Compute duration for stats (minutes only)
        let durationMinutes = '-';
        if (durationSeconds > 0) {
          durationMinutes = durationSeconds >= 60 ? Math.floor(durationSeconds / 60).toString() : '不到1';
        } else if (duration > 0) {
          durationMinutes = duration.toString();
        }

        this.setData({
          scenario: detail.scenario,
          scenarioTitle: detail.scenario_title || this.formatScenarioName(detail.scenario),
          date: this.formatDate(detail.created_at),
          duration: detail.duration || 0,
          durationSeconds: detail.duration_seconds || 0,
          durationDisplay: durationDisplay,
          durationMinutes: durationMinutes,
          turns: detail.current_turn || 0,
          maxTurns: detail.max_turns || 0,
          rating: detail.rating,
          overallScore: detail.overall_score,
          grammarScore: detail.grammar_score,
          fluencyScore: detail.fluency_score,
          vocabularyScore: detail.vocabulary_score,
          taskCompletionScore: detail.task_completion_score,
          evaluationStrengths: detail.evaluation_strengths || '',
          evaluationImprovements: detail.evaluation_improvements || '',
          evaluationSummary: detail.evaluation_summary || '',
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
    if (!scenario) return '对话练习';
    const nameMap = {
      'job_interview': '求职面试',
      'hotel_checkin': '酒店入住',
      'salary_negotiation': '薪资谈判',
      'renting': '租房咨询'
    };
    if (scenario.startsWith('custom_')) {
      return '自定义场景';
    }
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

  formatDuration(seconds) {
    if (!seconds || seconds <= 0) return '0分钟';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 1) return '不到1分钟';
    return `${minutes}分钟`;
  },

  getScoreColor(score) {
    if (!score) return 'rgba(255, 255, 255, 0.6)';
    if (score >= 90) return '#52C41A';
    if (score >= 70) return '#FAAD14';
    return '#FF4D4F';
  },

  onShareAppMessage() {
    return {
      title: `我在 LangCoach 完成了${this.data.scenarioTitle}练习`,
      path: '/pages/home/home'
    };
  }
});
