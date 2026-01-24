const app = getApp();
const { ScenarioUtils } = require('../../utils/scenarios');
const { api } = require('../../utils/api');

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
    keyboardHeight: 0,
    // 学习模式: prompt(提示模式) | listening(听力模式)
    learningMode: 'prompt',
    // 当前显示的对话提示
    currentChatTips: null,
    // 是否显示对话提示
    showChatTips: false
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
      if (this.data.playingMessageId) {
        this.updateMessagePlayingState(this.data.playingMessageId, false);
        this.setData({ playingMessageId: null });
      }
      // 播放结束后，如果是提示模式且有待显示的对话提示，则显示
      if (this._pendingChatTips && this.data.learningMode === 'prompt') {
        this.showChatTipsForMessage(this._pendingMessageId, this._pendingChatTips);
        this._pendingChatTips = null;
        this._pendingMessageId = null;
      }
    });

    this.innerAudioContext.onError((err) => {
      console.error('播放错误', err);
      if (this.data.playingMessageId) {
        this.updateMessagePlayingState(this.data.playingMessageId, false);
        this.setData({ playingMessageId: null });
      }
      wx.showToast({ title: '播放失败', icon: 'none' });
    });

    this.innerAudioContext.onStop(() => {
      if (this.data.playingMessageId) {
        this.updateMessagePlayingState(this.data.playingMessageId, false);
        this.setData({ playingMessageId: null });
      }
    });
  },

  // 加载场景
  loadScenario() {
    const scenario = app.globalData.settings.scenario;
    const settings = app.globalData.settings;

    let scenarioTitle = '自由对话';
    let scenarioId = null;

    // 处理场景配置 - 支持两种格式:
    // 1. { scenario: 'job_interview', title: '...' } - 来自 home 页面
    // 2. { id: 'job_interview', name: '...' } - 来自场景列表
    if (scenario) {
      scenarioId = scenario.scenario || scenario.id;
      if (scenarioId) {
        const scenarioData = ScenarioUtils.getScenario(scenarioId);
        scenarioTitle = scenarioData ? scenarioData.name : scenario.title || scenario.name || '对话练习';
      } else if (scenario.title || scenario.name) {
        scenarioTitle = scenario.title || scenario.name;
      }
    }

    this.setData({
      scenario: scenario ? { ...scenario, scenario: scenarioId } : null,
      scenarioTitle: scenarioTitle,
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
      const response = await api.chat.start({
        scenario: this.data.scenario,
        level: app.globalData.settings.level,
        turns: this.data.maxTurns
      });

      this.setData({
        sessionId: response.session_id,
        isLoading: false
      });

      // 添加AI开场白
      if (response.greeting) {
        const greetingMsgId = this.addMessage({
          role: 'assistant',
          content: response.greeting,
          audioUrl: response.audio_url
        });
        
        // 自动播放开场白语音
        if (response.audio_url) {
          setTimeout(() => {
            this.autoPlayAudio(response.audio_url, greetingMsgId);
          }, 1000); // 给页面一些时间渲染
        }
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
      'job_interview': "Hello! I'm your interviewer today. Please have a seat and let's begin. Could you start by telling me a little about yourself?",
      'hotel_checkin': "Good evening! Welcome to our hotel. I'll be helping you with check-in today. May I have your name and reservation details, please?",
      'renting': "Hi there! I'm the property manager. I understand you're interested in renting this apartment. Would you like me to show you around first?",
      'salary_negotiation': "Thank you for coming in today. We've reviewed your application and would like to discuss the compensation package. What are your salary expectations?",
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
        timeout: 120000,  // 语音识别需要更长时间
        formData: {
          session_id: this.data.sessionId || ''
        },
        success: (res) => {
          try {
            const data = JSON.parse(res.data);
            if (data.text) {
              resolve(data.text);
            } else {
              reject(new Error('转写失败'));
            }
          } catch (e) {
            reject(new Error('解析响应失败'));
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
      const response = await api.chat.message({
        session_id: this.data.sessionId,
        message: text
      });

      this.setData({
        isLoading: false,
        currentTurn: this.data.currentTurn + 1
      });

      // 添加AI回复
      const aiMsgId = this.addMessage({
        role: 'assistant',
        content: response.reply,
        audioUrl: response.audio_url,
        feedback: response.feedback,
        chatTips: response.chat_tips,
        // 听力模式下隐藏文本
        hideText: this.data.learningMode === 'listening'
      });

      // 自动播放AI语音回复
      if (response.audio_url) {
        setTimeout(() => {
          this.autoPlayAudio(response.audio_url, aiMsgId, response.chat_tips);
        }, 500); // 稍微延迟以确保渲染完成
      }

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
  onAudioTap(e) {
    const { audioUrl, playing, role } = e.detail;
    
    // 根据audioUrl找到对应的消息ID
    const message = this.data.messages.find(msg => msg.audioUrl === audioUrl);
    if (!message) return;
    
    if (playing || this.data.playingMessageId === message.id) {
      // 停止播放
      this.stopAudio();
    } else {
      // 开始播放
      this.playAudio(audioUrl, message.id);
    }
  },

  // 播放音频
  playAudio(audioUrl, messageId) {
    // 停止当前播放
    this.stopAudio();
    
    // 确保使用完整的URL
    const fullUrl = audioUrl.startsWith('http') ? audioUrl : `${app.globalData.baseUrl}${audioUrl}`;
    
    this.innerAudioContext.src = fullUrl;
    this.innerAudioContext.play();
    this.setData({ playingMessageId: messageId });
    
    // 更新对应组件的播放状态
    this.updateMessagePlayingState(messageId, true);
  },

  // 停止音频播放
  stopAudio() {
    if (this.data.playingMessageId) {
      this.innerAudioContext.stop();
      this.updateMessagePlayingState(this.data.playingMessageId, false);
      this.setData({ playingMessageId: null });
    }
  },

  // 自动播放AI回复音频
  autoPlayAudio(audioUrl, messageId, chatTips) {
    if (audioUrl) {
      this.playAudio(audioUrl, messageId);
      // 如果是提示模式且有对话提示，在播放完成后显示
      if (this.data.learningMode === 'prompt' && chatTips) {
        this._pendingChatTips = chatTips;
        this._pendingMessageId = messageId;
      }
    }
  },

  // 更新消息的播放状态
  updateMessagePlayingState(messageId, playing) {
    // 通过selectComponent更新对应组件的状态
    const messages = this.data.messages;
    const messageIndex = messages.findIndex(msg => msg.id === messageId);
    if (messageIndex !== -1) {
      const component = this.selectComponent(`#bubble-${messageIndex}`);
      if (component && component.setPlayingState) {
        component.setPlayingState(playing);
      }
    }
  },

  // 播放音频 (兼容旧方法)
  playAudioOld(e) {
    const { id, url } = e.currentTarget.dataset;
    if (this.data.playingMessageId === id) {
      this.stopAudio();
    } else {
      this.playAudio(url, id);
    }
  },

  // 点击单词查看翻译
  onWordTap(e) {
    const { word } = e.detail;
    wx.showLoading({ title: '查询中...' });

    api.dictionary.lookup(word).then(res => {
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

    api.chat.rate({
      session_id: this.data.sessionId,
      rating,
      feedback
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
    api.chat.feedback({
      session_id: this.data.sessionId,
      message_id: id,
      feedback: type
    }).catch(console.error);

    // 更新本地状态
    this.updateMessage(id, { userFeedback: type });
    wx.showToast({ title: '感谢反馈', icon: 'none' });
  },

  // 切换学习模式
  switchLearningMode(e) {
    const mode = e.currentTarget.dataset.mode;
    if (mode === this.data.learningMode) return;

    this.setData({
      learningMode: mode,
      showChatTips: false,
      currentChatTips: null
    });

    // 更新所有消息的显示状态
    const messages = this.data.messages.map(msg => {
      if (msg.role === 'assistant') {
        return {
          ...msg,
          hideText: mode === 'listening',
          showTips: false
        };
      }
      return msg;
    });
    this.setData({ messages });

    wx.showToast({
      title: mode === 'prompt' ? '提示模式' : '听力模式',
      icon: 'none'
    });
  },

  // 显示对话提示
  showChatTipsForMessage(messageId, chatTips) {
    if (!chatTips) return;

    // 更新消息的showTips状态
    const messages = this.data.messages.map(msg => {
      if (msg.id === messageId) {
        return { ...msg, showTips: true };
      }
      return msg;
    });

    this.setData({
      messages,
      currentChatTips: chatTips,
      showChatTips: true
    });
  },

  // 隐藏对话提示
  hideChatTips() {
    this.setData({
      showChatTips: false,
      currentChatTips: null
    });
  },

  // 重新播放消息音频
  replayAudio(e) {
    const { id, audioUrl } = e.currentTarget.dataset;
    if (audioUrl) {
      this.playAudio(audioUrl, id);
    }
  }
});
