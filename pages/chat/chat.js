const app = getApp();
const { ScenarioUtils } = require('../../utils/scenarios');
const { api } = require('../../utils/api');

Page({
  data: {
    // 场景信息
    scenario: null,
    scenarioTitle: '自由对话',
    isCustomScenario: false,
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
    showChatTips: false,
    // 触摸相关状态
    touchStartY: 0,
    isCancelArea: false,
    // 音频播放权限状态
    audioPermissionGranted: false,
    showAudioTip: false,
    // 待播放的开场白音频（首次加载时需要用户交互后才能播放）
    pendingGreetingAudio: null,
    pendingGreetingMsgId: null,
    // 是否显示开场白播放提示
    showGreetingPlayTip: false,
    // 退出确认弹窗
    showExitModal: false
  },

  // 录音管理器
  recorderManager: null,
  // 音频播放器
  innerAudioContext: null,
  // 录音计时器
  recordingTimer: null,
  // 录音是否被取消
  recordingCancelled: false,

  onLoad(options) {
    console.log('=== 聊天页面加载 ===');
    this.initRecorder();
    this.initAudioPlayer();
    this.loadScenario();
    
    // 检查设备信息和环境
    this.checkEnvironment();
  },

  // 检查运行环境
  checkEnvironment() {
    const systemInfo = wx.getSystemInfoSync();
    console.log('设备信息:', {
      platform: systemInfo.platform,
      system: systemInfo.system,
      version: systemInfo.version,
      SDKVersion: systemInfo.SDKVersion
    });
    
    // 检查是否在开发者工具中
    if (systemInfo.platform === 'devtools') {
      console.log('在开发者工具中运行，音频自动播放可能正常');
      this.setData({ audioPermissionGranted: true });
    } else {
      console.log('在真机中运行，需要检查音频播放权限');
    }
  },

  onShow() {
    // 检查是否有新场景
    const scenario = app.globalData.settings.scenario;
    if (scenario && (!this.data.scenario || scenario.scenario !== this.data.scenario.scenario)) {
      this.loadScenario();
    }
    
    // 尝试预解锁音频播放权限
    this.tryUnlockAudioPermission();
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
      
      // 如果录音被取消，不处理录音结果
      if (this.recordingCancelled) {
        this.recordingCancelled = false;
        return;
      }
      
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
    // 使用 useWebAudioImplement 参数，在某些场景下可以绕过自动播放限制
    this.innerAudioContext = wx.createInnerAudioContext({
      useWebAudioImplement: true  // 使用 WebAudio 实现，更好的兼容性
    });
    
    // 设置为不遵守静音开关，允许在静音模式下播放
    this.innerAudioContext.obeyMuteSwitch = false;
    // 设置自动播放
    this.innerAudioContext.autoplay = true; // 设置为自动播放

    this.innerAudioContext.onPlay(() => {
      console.log('音频开始播放 - 自动播放权限已解锁');
      // 首次成功播放后，标记权限已获取
      if (!this.data.audioPermissionGranted) {
        console.log('更新权限状态为已授权');
        this.setData({ audioPermissionGranted: true, showAudioTip: false });
      }
    });

    this.innerAudioContext.onEnded(() => {
      console.log('音频播放结束');
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
      console.error('音频播放器错误:', err);
      console.error('错误代码:', err.errCode);
      console.error('错误信息:', err.errMsg);
      
      if (this.data.playingMessageId) {
        this.updateMessagePlayingState(this.data.playingMessageId, false);
        this.setData({ playingMessageId: null });
      }
      
      // 检查是否为权限相关错误
      if (err.errCode === 10003 || err.errMsg.includes('interrupted') || err.errMsg.includes('NotAllowed')) {
        console.log('可能是音频权限问题，显示提示');
        this.setData({ showAudioTip: true });
      } else {
        // 显示更详细的错误信息
        const errorMessages = {
          10001: '系统错误',
          10002: '网络错误',
          10003: '文件错误',
          10004: '格式错误'
        };
        const errorMsg = errorMessages[err.errCode] || '播放失败';
        wx.showToast({ title: errorMsg, icon: 'none', duration: 2000 });
      }
    });

    this.innerAudioContext.onStop(() => {
      console.log('音频播放停止');
      if (this.data.playingMessageId) {
        this.updateMessagePlayingState(this.data.playingMessageId, false);
        this.setData({ playingMessageId: null });
      }
    });

    this.innerAudioContext.onCanplay(() => {
      console.log('音频可以播放了');
    });

    this.innerAudioContext.onWaiting(() => {
      console.log('音频加载中...');
    });

    this.innerAudioContext.onSeeking(() => {
      console.log('音频跳转中');
    });

    this.innerAudioContext.onSeeked(() => {
      console.log('音频跳转完成');
    });
  },

  // 加载场景
  loadScenario() {
    const scenario = app.globalData.settings.scenario;
    const settings = app.globalData.settings;

    let scenarioTitle = '自由对话';
    let scenarioId = null;
    let isCustomScenario = false;

    // 处理场景配置 - 支持多种格式:
    // 1. { scenario: 'job_interview', title: '...' } - 来自 home 页面
    // 2. { id: 'job_interview', name: '...' } - 来自场景列表
    // 3. { scenario: 'custom_xxx', isCustom: true, ... } - 自定义场景
    if (scenario) {
      scenarioId = scenario.scenario || scenario.id;
      isCustomScenario = scenario.isCustom || (scenarioId && scenarioId.startsWith('custom_'));

      if (isCustomScenario) {
        // 自定义场景使用用户输入的标题
        scenarioTitle = scenario.title || '自定义场景';
      } else if (scenarioId) {
        const scenarioData = ScenarioUtils.getScenario(scenarioId);
        scenarioTitle = scenarioData ? scenarioData.name : scenario.title || scenario.name || '对话练习';
      } else if (scenario.title || scenario.name) {
        scenarioTitle = scenario.title || scenario.name;
      }
    }

    this.setData({
      scenario: scenario ? { ...scenario, scenario: scenarioId } : null,
      scenarioTitle: scenarioTitle,
      isCustomScenario: isCustomScenario,
      maxTurns: isCustomScenario ? 9999 : settings.turns,
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
      // 检查是否是自定义场景且已有预生成的开场白
      const scenario = this.data.scenario;
      const isCustomWithGreeting = scenario && scenario.isCustom && scenario.greeting;

      const response = await api.chat.start({
        scenario: this.data.scenario,
        level: app.globalData.settings.level,
        turns: this.data.maxTurns
      });

      this.setData({
        sessionId: response.session_id,
        isLoading: false
      });

      // 添加AI开场白 - 自定义场景优先使用预生成的开场白
      const greeting = isCustomWithGreeting ? scenario.greeting : response.greeting;
      const audioUrl = isCustomWithGreeting && scenario.audioUrl ? scenario.audioUrl : response.audio_url;

      if (greeting) {
        const greetingMsgId = this.addMessage({
          role: 'assistant',
          content: greeting,
          audioUrl: audioUrl
        });

        // 处理开场白音频播放
        if (audioUrl) {
          // 检查是否已获得音频播放权限
          if (this.data.audioPermissionGranted) {
            // 已有权限，直接播放
            console.log('音频权限已获取，直接播放开场白');
            this.autoPlayAudio(audioUrl, greetingMsgId);
          } else {
            // 没有权限，保存待播放的音频信息，显示提示
            console.log('音频权限未获取，保存开场白音频待播放');
            this.setData({
              pendingGreetingAudio: audioUrl,
              pendingGreetingMsgId: greetingMsgId,
              showGreetingPlayTip: true
            });
          }
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

  // 触摸开始
  onTouchStart(e) {
    const touch = e.touches[0];
    this.setData({
      touchStartY: touch.clientY,
      isCancelArea: false
    });
    this.startRecording();
  },

  // 触摸移动
  onTouchMove(e) {
    if (!this.data.isRecording) return;
    
    const touch = e.touches[0];
    const moveY = this.data.touchStartY - touch.clientY;
    const isCancelArea = moveY > 100; // 上滑超过100px进入取消区域
    
    if (isCancelArea !== this.data.isCancelArea) {
      this.setData({ isCancelArea });
      
      // 可选：添加震动反馈
      if (isCancelArea) {
        wx.vibrateShort({ type: 'light' });
      }
    }
  },

  // 触摸结束
  onTouchEnd(e) {
    if (!this.data.isRecording) return;
    
    if (this.data.isCancelArea) {
      this.cancelRecording();
    } else {
      this.stopRecording();
    }
    
    this.setData({
      touchStartY: 0,
      isCancelArea: false
    });
  },

  // 开始录音
  startRecording() {
    wx.authorize({
      scope: 'scope.record',
      success: () => {
        this.recordingCancelled = false;
        // 用户开始录音也视为交互，可以解锁音频播放权限
        this.setData({ 
          isRecording: true, 
          recordingDuration: 0,
          audioPermissionGranted: true,
          showAudioTip: false,
          showGreetingPlayTip: false
        });
        
        // 如果有待播放的开场白音频，先播放它
        this.playPendingGreetingAudio();
        
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
      this.recordingCancelled = true;
      this.recorderManager.stop();
      this.stopRecordingTimer();
      this.setData({ 
        isRecording: false,
        recordingDuration: 0
      });
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
        console.log('准备自动播放AI回复音频:', response.audio_url);
        setTimeout(() => {
          this.autoPlayAudio(response.audio_url, aiMsgId, response.chat_tips);
        }, 500); // 稍微延迟以确保渲染完成
      } else {
        console.log('没有收到音频URL，跳过自动播放');
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
    // 直接调用 directPlayAudio 方法
    this.directPlayAudio(audioUrl, messageId, null);
  },

  // 停止音频播放
  stopAudio() {
    if (this.data.playingMessageId) {
      try {
        if (this.innerAudioContext) {
          this.innerAudioContext.stop();
        }
      } catch (e) {
        console.log('停止音频时出错:', e);
      }
      this.updateMessagePlayingState(this.data.playingMessageId, false);
      this.setData({ playingMessageId: null });
    }
  },

  // 自动播放AI回复音频
  autoPlayAudio(audioUrl, messageId, chatTips) {
    if (!audioUrl) {
      console.warn('没有音频URL，跳过自动播放');
      return;
    }
    
    console.log('=== 自动播放音频 ===');
    console.log('音频URL:', audioUrl);
    console.log('消息ID:', messageId);
    
    // 直接调用播放方法
    this.directPlayAudio(audioUrl, messageId, chatTips);
  },

  // 直接播放音频的方法
  directPlayAudio(audioUrl, messageId, chatTips) {
    // 确保使用完整的URL
    const fullUrl = audioUrl.startsWith('http') ? audioUrl : `${app.globalData.baseUrl}${audioUrl}`;
    
    console.log('=== 直接播放音频 ===');
    console.log('完整URL:', fullUrl);
    
    // 停止当前播放
    this.stopAudio();
    
    // 更新状态
    this.setData({ playingMessageId: messageId });
    this.updateMessagePlayingState(messageId, true);
    
    // 重新创建音频上下文以确保干净的状态
    if (this.innerAudioContext) {
      this.innerAudioContext.destroy();
    }
    
    this.innerAudioContext = wx.createInnerAudioContext({
      useWebAudioImplement: true
    });
    this.innerAudioContext.obeyMuteSwitch = false;
    
    // 设置播放回调
    this.innerAudioContext.onPlay(() => {
      console.log('音频开始播放');
      this.setData({ audioPermissionGranted: true, showAudioTip: false });
    });
    
    this.innerAudioContext.onEnded(() => {
      console.log('音频播放结束');
      this.updateMessagePlayingState(messageId, false);
      this.setData({ playingMessageId: null });
      
      // 播放结束后显示对话提示
      if (this._pendingChatTips && this.data.learningMode === 'prompt') {
        this.showChatTipsForMessage(this._pendingMessageId, this._pendingChatTips);
        this._pendingChatTips = null;
        this._pendingMessageId = null;
      }
    });
    
    this.innerAudioContext.onError((err) => {
      console.error('音频播放错误:', err);
      this.updateMessagePlayingState(messageId, false);
      this.setData({ playingMessageId: null });
    });
    
    // 设置音频源并播放
    console.log('设置音频源:', fullUrl);
    this.innerAudioContext.src = fullUrl;
    this.innerAudioContext.play();
    
    // 如果是提示模式且有对话提示，在播放完成后显示
    if (this.data.learningMode === 'prompt' && chatTips) {
      this._pendingChatTips = chatTips;
      this._pendingMessageId = messageId;
    }
  },

  // 处理播放错误
  handlePlayError(messageId) {
    console.log('音频播放出错，重置状态');
    this.updateMessagePlayingState(messageId, false);
    this.setData({ 
      playingMessageId: null,
      showAudioTip: true 
    });
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
      // 用户主动点击播放，标记权限已获取
      this.setData({ 
        audioPermissionGranted: true, 
        showAudioTip: false,
        showGreetingPlayTip: false
      });
      
      // 清除待播放的开场白（如果用户点击其他音频播放，说明已交互）
      if (this.data.pendingGreetingAudio) {
        this.setData({
          pendingGreetingAudio: null,
          pendingGreetingMsgId: null
        });
      }
      
      this.playAudio(audioUrl, id);
    }
  },

  // 用户点击播放按钮，解锁音频播放权限
  onAudioTap(e) {
    const { audioUrl, messageId } = e.detail;
    console.log('用户点击播放按钮:', audioUrl, messageId);
    
    // 标记用户已同意播放音频
    this.setData({ 
      audioPermissionGranted: true, 
      showAudioTip: false,
      showGreetingPlayTip: false
    });
    
    // 清除待播放的开场白
    if (this.data.pendingGreetingAudio) {
      this.setData({
        pendingGreetingAudio: null,
        pendingGreetingMsgId: null
      });
    }
    
    // 播放音频
    this.playAudio(audioUrl, messageId);
  },
  
  // 尝试预解锁音频播放权限
  tryUnlockAudioPermission() {
    // 如果已经有权限，无需操作
    if (this.data.audioPermissionGranted) {
      console.log('音频权限已获取，无需预解锁');
      return;
    }

    console.log('尝试预解锁音频播放权限');
    
    try {
      // 创建一个极短的静音音频来测试权限
      const testAudio = wx.createInnerAudioContext();
      testAudio.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
      testAudio.volume = 0; // 静音
      testAudio.obeyMuteSwitch = false;
      
      const self = this;
      testAudio.onPlay(() => {
        console.log('预解锁成功：音频播放权限已获取');
        self.setData({ 
          audioPermissionGranted: true, 
          showAudioTip: false,
          showGreetingPlayTip: false
        });
        testAudio.destroy();
        
        // 预解锁成功后，播放待播放的开场白
        self.playPendingGreetingAudio();
      });
      
      testAudio.onError((err) => {
        console.log('预解锁失败，需要用户交互:', err);
        testAudio.destroy();
        // 不显示错误提示，只在实际需要播放时才提示
      });
      
      // 尝试播放静音音频
      testAudio.play();
      
      // 2秒后清理
      setTimeout(() => {
        try {
          testAudio.destroy();
        } catch (e) {
          // 忽略销毁错误
        }
      }, 2000);
      
    } catch (err) {
      console.log('创建测试音频失败:', err);
    }
  },

  // 隐藏音频提示
  hideAudioTip() {
    this.setData({ showAudioTip: false });
  },

  // 播放待播放的开场白音频
  playPendingGreetingAudio() {
    const { pendingGreetingAudio, pendingGreetingMsgId } = this.data;
    
    if (pendingGreetingAudio && pendingGreetingMsgId) {
      console.log('播放待播放的开场白音频:', pendingGreetingAudio);
      
      // 清除待播放状态
      this.setData({
        pendingGreetingAudio: null,
        pendingGreetingMsgId: null,
        showGreetingPlayTip: false
      });
      
      // 延迟播放，确保用户交互已完成
      setTimeout(() => {
        this.directPlayAudio(pendingGreetingAudio, pendingGreetingMsgId, null);
      }, 300);
    }
  },

  // 点击播放开场白提示
  onGreetingPlayTap() {
    console.log('用户点击播放开场白');
    
    // 标记已获得权限
    this.setData({ 
      audioPermissionGranted: true,
      showGreetingPlayTip: false
    });
    
    // 播放待播放的开场白
    this.playPendingGreetingAudio();
  },

  // 隐藏开场白播放提示
  hideGreetingPlayTip() {
    this.setData({ showGreetingPlayTip: false });
  },

  // ========== 退出确认相关方法 ==========

  // 点击退出按钮
  onExitTap() {
    // 如果对话轮数较少，显示确认弹窗
    if (this.data.currentTurn > 0) {
      this.setData({ showExitModal: true });
    } else {
      // 没有对话直接退出
      this.confirmExit();
    }
  },

  // 隐藏退出确认弹窗
  hideExitModal() {
    this.setData({ showExitModal: false });
  },

  // 确认退出
  confirmExit() {
    this.setData({ showExitModal: false });

    // 清理资源
    this.cleanup();

    // 清除场景配置
    app.globalData.settings.scenario = null;

    // 返回首页
    wx.switchTab({
      url: '/pages/home/home'
    });
  }
});
