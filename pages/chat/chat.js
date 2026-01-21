const app = getApp();

Page({
  data: {
    // 场景信息
    scenario: null,
    scenarioTitle: '自由对话',
    // 消息列表
    messages: [],
    // 输入相关
    inputText: '',
    inputMode: 'voice', // voice | text
    // 录音状态
    isRecording: false,
    recordingDuration: 0,
    voiceAnimationData: {},
    // 会话状态
    sessionId: null,
    isLoading: false,
    currentTurn: 0,
    maxTurns: 20,
    // 评分弹窗
    showRatingModal: false,
    sessionReport: null,
    // 滚动
    scrollToMessage: '',
    // 键盘高度
    keyboardHeight: 0
  },

  // 录音管理器
  recorderManager: null,
  // 音频播放器
  innerAudioContext: null,
  // 录音计时器
  recordingTimer: null,

  onLoad(options) {
    this.initRecorder();
    this.initAudioPlayer();
    this.loadScenario();
  },

  onShow() {
    // 检查是否有新场景
    const scenario = app.globalData.settings.scenario;
    if (scenario && (!this.data.scenario || scenario.scenario !== this.data.scenario.scenario)) {
      this.loadScenario();
    }
  },

  onUnload() {
    this.cleanup();
  },

  // 初始化录音管理器
  initRecorder() {
    this.recorderManager = wx.getRecorderManager();

    this.recorderManager.onStart(() => {
      console.log('录音开始');
      this.startRecordingTimer();
    });

    this.recorderManager.onStop((res) => {
      console.log('录音结束', res);
      this.stopRecordingTimer();
      if (res.duration < 1000) {
        wx.showToast({ title: '录音时间太短', icon: 'none' });
        return;
      }
      this.handleVoiceMessage(res.tempFilePath, res.duration);
    });

    this.recorderManager.onError((err) => {
      console.error('录音错误', err);
      this.stopRecordingTimer();
      wx.showToast({ title: '录音失败', icon: 'none' });
      this.setData({ isRecording: false });
    });
  },

  // 初始化音频播放器
  initAudioPlayer() {
    this.innerAudioContext = wx.createInnerAudioContext();
    this.innerAudioContext.onEnded(() => {
      this.setData({ playingMessageId: null });
    });
    this.innerAudioContext.onError((err) => {
      console.error('播放错误', err);
      this.setData({ playingMessageId: null });
    });
  },

  // 加载场景
  loadScenario() {
    const scenario = app.globalData.settings.scenario;
    const settings = app.globalData.settings;

    this.setData({
      scenario: scenario,
      scenarioTitle: scenario ? scenario.title : '自由对话',
      maxTurns: settings.turns,
      messages: [],
      currentTurn: 0,
      sessionId: null
    });

    // 开始新会话
    this.startSession();
  },

  // 开始会话
  async startSession() {
    this.setData({ isLoading: true });

    try {
      const response = await this.request('/api/chat/start', {
        method: 'POST',
        data: {
          scenario: this.data.scenario,
          level: app.globalData.settings.level,
          turns: this.data.maxTurns
        }
      });

      this.setData({
        sessionId: response.session_id,
        isLoading: false
      });

      // 添加AI开场白
      if (response.greeting) {
        this.addMessage({
          role: 'assistant',
          content: response.greeting,
          audioUrl: response.audio_url
        });
      }
    } catch (error) {
      console.error('开始会话失败', error);
      this.setData({ isLoading: false });
      // 添加模拟开场白
      this.addMessage({
        role: 'assistant',
        content: this.getDefaultGreeting()
      });
    }
  },

  // 获取默认开场白
  getDefaultGreeting() {
    const greetings = {
      'interview': "Hello! I'm your interviewer today. Please have a seat and let's begin. Could you start by telling me a little about yourself?",
      'restaurant': "Good evening! Welcome to our restaurant. I'll be your server tonight. Can I start you off with something to drink?",
      'airport': "Good morning! Welcome to the check-in counter. May I see your passport and booking confirmation, please?",
      'default': "Hi there! I'm your English practice partner. What would you like to talk about today?"
    };
    const scenario = this.data.scenario?.scenario || 'default';
    return greetings[scenario] || greetings.default;
  },

  // 切换输入模式
  toggleInputMode() {
    this.setData({
      inputMode: this.data.inputMode === 'voice' ? 'text' : 'voice'
    });
  },

  // 开始录音
  startRecording() {
    wx.authorize({
      scope: 'scope.record',
      success: () => {
        this.setData({ isRecording: true, recordingDuration: 0 });
        this.recorderManager.start({
          duration: 60000,
          sampleRate: 16000,
          numberOfChannels: 1,
          encodeBitRate: 48000,
          format: 'mp3'
        });
      },
      fail: () => {
        wx.showModal({
          title: '提示',
          content: '需要录音权限才能使用语音功能',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting();
            }
          }
        });
      }
    });
  },

  // 停止录音
  stopRecording() {
    if (this.data.isRecording) {
      this.recorderManager.stop();
      this.setData({ isRecording: false });
    }
  },

  // 取消录音
  cancelRecording() {
    if (this.data.isRecording) {
      this.recorderManager.stop();
      this.setData({ isRecording: false });
      wx.showToast({ title: '已取消', icon: 'none' });
    }
  },

  // 录音计时器
  startRecordingTimer() {
    this.recordingTimer = setInterval(() => {
      this.setData({
        recordingDuration: this.data.recordingDuration + 1
      });
    }, 1000);
  },

  stopRecordingTimer() {
    if (this.recordingTimer) {
      clearInterval(this.recordingTimer);
      this.recordingTimer = null;
    }
  },

  // 处理语音消息
  async handleVoiceMessage(filePath, duration) {
    // 先添加用户语音消息（显示加载状态）
    const userMsgId = this.addMessage({
      role: 'user',
      type: 'voice',
      audioUrl: filePath,
      duration: Math.ceil(duration / 1000),
      transcribing: true
    });

    this.setData({ isLoading: true });

    try {
      // 上传音频并获取转写
      const transcription = await this.uploadAndTranscribe(filePath);

      // 更新用户消息
      this.updateMessage(userMsgId, {
        content: transcription,
        transcribing: false
      });

      // 发送到AI获取回复
      await this.sendToAI(transcription);
    } catch (error) {
      console.error('处理语音失败', error);
      this.updateMessage(userMsgId, {
        content: '[语音识别失败]',
        transcribing: false,
        error: true
      });
      this.setData({ isLoading: false });
    }
  },

  // 上传并转写音频
  async uploadAndTranscribe(filePath) {
    return new Promise((resolve, reject) => {
      wx.uploadFile({
        url: `${app.globalData.baseUrl}/api/transcribe`,
        filePath: filePath,
        name: 'audio',
        formData: {
          session_id: this.data.sessionId
        },
        success: (res) => {
          const data = JSON.parse(res.data);
          if (data.text) {
            resolve(data.text);
          } else {
            reject(new Error('转写失败'));
          }
        },
        fail: reject
      });
    });
  },

  // 发送文本消息
  sendTextMessage() {
    const text = this.data.inputText.trim();
    if (!text) return;

    this.addMessage({
      role: 'user',
      content: text
    });

    this.setData({ inputText: '' });
    this.sendToAI(text);
  },

  // 发送到AI
  async sendToAI(text) {
    this.setData({ isLoading: true });

    try {
      const response = await this.request('/api/chat/message', {
        method: 'POST',
        data: {
          session_id: this.data.sessionId,
          message: text
        }
      });

      this.setData({
        isLoading: false,
        currentTurn: this.data.currentTurn + 1
      });

      // 添加AI回复
      this.addMessage({
        role: 'assistant',
        content: response.reply,
        audioUrl: response.audio_url,
        feedback: response.feedback
      });

      // 检查是否结束
      if (response.session_ended || this.data.currentTurn >= this.data.maxTurns) {
        this.endSession(response.report);
      }
    } catch (error) {
      console.error('发送消息失败', error);
      this.setData({ isLoading: false });
      // 模拟回复
      this.addMessage({
        role: 'assistant',
        content: "I understand. Could you tell me more about that?"
      });
    }
  },

  // 添加消息
  addMessage(message) {
    const id = `msg_${Date.now()}`;
    const newMessage = {
      id,
      timestamp: Date.now(),
      ...message
    };

    const messages = [...this.data.messages, newMessage];
    this.setData({
      messages,
      scrollToMessage: id
    });

    return id;
  },

  // 更新消息
  updateMessage(id, updates) {
    const messages = this.data.messages.map(msg =>
      msg.id === id ? { ...msg, ...updates } : msg
    );
    this.setData({ messages });
  },

  // 播放音频
  playAudio(e) {
    const { id, url } = e.currentTarget.dataset;
    if (this.data.playingMessageId === id) {
      this.innerAudioContext.stop();
      this.setData({ playingMessageId: null });
    } else {
      this.innerAudioContext.src = url;
      this.innerAudioContext.play();
      this.setData({ playingMessageId: id });
    }
  },

  // 点击单词查看翻译
  onWordTap(e) {
    const { word } = e.detail;
    wx.showLoading({ title: '查询中...' });

    this.request('/api/dictionary', {
      method: 'GET',
      data: { word }
    }).then(res => {
      wx.hideLoading();
      wx.showModal({
        title: word,
        content: `${res.phonetic || ''}\n${res.definition || '暂无释义'}`,
        confirmText: '加入生词本',
        cancelText: '关闭',
        success: (result) => {
          if (result.confirm) {
            this.addToFlashcards(word, res);
          }
        }
      });
    }).catch(() => {
      wx.hideLoading();
      wx.showToast({ title: '查询失败', icon: 'none' });
    });
  },

  // 加入生词本
  addToFlashcards(word, definition) {
    const flashcards = wx.getStorageSync('flashcards') || [];
    if (!flashcards.find(f => f.word === word)) {
      flashcards.push({
        word,
        definition: definition.definition,
        phonetic: definition.phonetic,
        addedAt: Date.now()
      });
      wx.setStorageSync('flashcards', flashcards);
      wx.showToast({ title: '已添加', icon: 'success' });
    } else {
      wx.showToast({ title: '已在生词本中', icon: 'none' });
    }
  },

  // 结束会话
  endSession(report) {
    this.setData({
      showRatingModal: true,
      sessionReport: report || {
        grammarScore: 85,
        vocabularyScore: 78,
        fluencyScore: 82,
        tips: ['Try using more complex sentence structures', 'Good use of vocabulary!']
      }
    });
  },

  // 提交评分
  onRatingSubmit(e) {
    const { rating, feedback } = e.detail;

    this.request('/api/chat/rate', {
      method: 'POST',
      data: {
        session_id: this.data.sessionId,
        rating,
        feedback
      }
    }).catch(console.error);

    // 更新统计
    const stats = app.globalData.stats;
    app.updateStats({
      totalSessions: stats.totalSessions + 1,
      totalMinutes: stats.totalMinutes + Math.ceil(this.data.currentTurn * 1.5)
    });

    this.setData({ showRatingModal: false });

    wx.showToast({ title: '感谢反馈！', icon: 'success' });
  },

  // 关闭评分弹窗
  closeRatingModal() {
    this.setData({ showRatingModal: false });
  },

  // 重新开始
  restartSession() {
    this.setData({ showRatingModal: false });
    this.loadScenario();
  },

  // 输入框变化
  onInputChange(e) {
    this.setData({ inputText: e.detail.value });
  },

  // 键盘高度变化
  onKeyboardHeightChange(e) {
    this.setData({ keyboardHeight: e.detail.height });
  },

  // 网络请求封装
  request(url, options = {}) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${app.globalData.baseUrl}${url}`,
        method: options.method || 'GET',
        data: options.data,
        header: {
          'Authorization': `Bearer ${app.globalData.sessionId}`,
          'Content-Type': 'application/json'
        },
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(res.data);
          } else {
            reject(new Error(res.data?.message || '请求失败'));
          }
        },
        fail: reject
      });
    });
  },

  // 清理资源
  cleanup() {
    this.stopRecordingTimer();
    if (this.innerAudioContext) {
      this.innerAudioContext.destroy();
    }
  },

  // 给AI消息点赞/踩
  onFeedback(e) {
    const { id, type } = e.currentTarget.dataset;
    this.request('/api/chat/feedback', {
      method: 'POST',
      data: {
        session_id: this.data.sessionId,
        message_id: id,
        feedback: type
      }
    }).catch(console.error);

    // 更新本地状态
    this.updateMessage(id, { userFeedback: type });
    wx.showToast({ title: '感谢反馈', icon: 'none' });
  }
});
