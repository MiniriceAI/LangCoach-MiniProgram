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
    sessionReady: false,
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
    showExitModal: false,
    // 会话级别设置
    showSessionSettings: false,
    sessionSettings: {
      speaker: '',  // 当前会话的语音角色
      speakingSpeed: 'medium',  // 语速预设: slow/medium/fast
      speakingRatePercent: 0,  // 精确语速百分比: -50 to 100
      speakingRate: '+0%'  // 发送给服务器的语速字符串
    },
    // 语音选项
    voiceOptions: [
      { code: 'Ceylia', name: 'Ceylia', desc: '美式女声 - 友好' },
      { code: 'Tifa', name: 'Tifa', desc: '美式女声 - 自然' },
      { code: 'David', name: 'David', desc: '美式男声 - 温和' },
      { code: 'Tony', name: 'Tony', desc: '美式男声 - 成熟' },
      { code: 'Emma', name: 'Emma', desc: '英式女声 - 优雅' },
      { code: 'Ryan', name: 'Ryan', desc: '英式男声 - 正式' },
      { code: 'Sarah', name: 'Sarah', desc: '澳式女声 - 活泼' },
      { code: 'William', name: 'William', desc: '澳式男声 - 友好' }
    ]
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
      // 尝试主动检测音频播放权限
      this.detectAudioPermission();
    }
  },

  // 检测音频播放权限
  detectAudioPermission() {
    // 创建一个临时音频播放器测试权限
    const testAudio = wx.createInnerAudioContext();
    testAudio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+HwymMcBDyS2e/MdSEIL3v47lUCWZ2+eR==';
    testAudio.volume = 0;
    testAudio.onCanplay(() => {
      console.log('音频权限检测：可以播放');
      this.setData({ audioPermissionGranted: true });
      testAudio.destroy();
    });
    testAudio.onError(() => {
      console.log('音频权限检测：需要用户交互');
      testAudio.destroy();
    });
    testAudio.play();
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

  // ============================================
  // 会话设置相关方法
  // ============================================

  // 显示会话设置弹窗
  showSessionSettings() {
    // 初始化会话设置（从全局设置或场景设置加载）
    const globalVoice = app.globalData.settings.voice || 'Ceylia';
    const scenarioSpeakingSpeed = this.data.scenario?.scenarioInfo?.speaking_speed || 'medium';

    // 如果已有会话设置，使用会话设置；否则使用全局/场景设置
    const currentSettings = this.data.sessionSettings.speaker ? this.data.sessionSettings : {
      speaker: globalVoice,
      speakingSpeed: scenarioSpeakingSpeed,
      speakingRatePercent: this.getSpeakingRatePercent(scenarioSpeakingSpeed),
      speakingRate: this.getSpeakingRateString(this.getSpeakingRatePercent(scenarioSpeakingSpeed))
    };

    this.setData({
      showSessionSettings: true,
      sessionSettings: currentSettings
    });
  },

  // 隐藏会话设置弹窗
  hideSessionSettings() {
    this.setData({ showSessionSettings: false });
  },

  // 阻止事件冒泡
  preventBubble() {
    // 空方法，仅用于阻止事件冒泡
  },

  // 选择会话语音角色
  selectSessionVoice(e) {
    const voice = e.currentTarget.dataset.voice;
    this.setData({
      'sessionSettings.speaker': voice
    });
  },

  // 选择语速预设
  selectSpeakingSpeed(e) {
    const speed = e.currentTarget.dataset.speed;
    const ratePercent = this.getSpeakingRatePercent(speed);
    this.setData({
      'sessionSettings.speakingSpeed': speed,
      'sessionSettings.speakingRatePercent': ratePercent,
      'sessionSettings.speakingRate': this.getSpeakingRateString(ratePercent)
    });
  },

  // 语速滑块变化中（实时显示）
  onSpeakingRateChanging(e) {
    const percent = e.detail.value;
    this.setData({
      'sessionSettings.speakingRatePercent': percent
    });
  },

  // 语速滑块变化完成
  onSpeakingRateChange(e) {
    const percent = e.detail.value;
    const rateString = this.getSpeakingRateString(percent);

    // 根据百分比更新语速预设
    let speed = 'medium';
    if (percent < -10) speed = 'slow';
    else if (percent > 10) speed = 'fast';

    this.setData({
      'sessionSettings.speakingRatePercent': percent,
      'sessionSettings.speakingRate': rateString,
      'sessionSettings.speakingSpeed': speed
    });
  },

  // 将语速预设转换为百分比
  getSpeakingRatePercent(speed) {
    const map = {
      'slow': -30,
      'medium': 0,
      'fast': 30
    };
    return map[speed] || 0;
  },

  // 将百分比转换为语速字符串
  getSpeakingRateString(percent) {
    if (percent >= 0) {
      return `+${percent}%`;
    }
    return `${percent}%`;
  },

  // 保存会话设置
  saveSessionSettings() {
    wx.showToast({
      title: '设置已保存',
      icon: 'success',
      duration: 1500
    });

    // 延迟关闭弹窗，让用户看到保存提示
    setTimeout(() => {
      this.hideSessionSettings();
    }, 500);

    console.log('Session settings saved:', this.data.sessionSettings);
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

    // 重置开场白播放状态
    this._greetingPlayed = false;
    this._greetingAudioUrl = null;
    this._greetingMsgId = null;

    this.setData({
      scenario: scenario ? { ...scenario, scenario: scenarioId } : null,
      scenarioTitle: scenarioTitle,
      isCustomScenario: isCustomScenario,
      maxTurns: isCustomScenario ? 9999 : settings.turns,
      messages: [],
      currentTurn: 0,
      sessionId: null,
      sessionReady: false,
      // 清除待播放的开场白状态
      pendingGreetingAudio: null,
      pendingGreetingMsgId: null,
      showGreetingPlayTip: false
    });

    // 初始化会话设置（从场景或全局设置）
    const scenarioSpeakingSpeed = scenario?.scenarioInfo?.speaking_speed || 'medium';
    const globalVoice = app.globalData.settings.voice || 'Ceylia';
    this.setData({
      'sessionSettings.speaker': globalVoice,
      'sessionSettings.speakingSpeed': scenarioSpeakingSpeed,
      'sessionSettings.speakingRatePercent': this.getSpeakingRatePercent(scenarioSpeakingSpeed),
      'sessionSettings.speakingRate': this.getSpeakingRateString(this.getSpeakingRatePercent(scenarioSpeakingSpeed))
    });

    // 开始新会话
    this.startSession();
  },

  // 开始会话
  async startSession(retryCount = 0) {
    this.setData({ isLoading: true });

    try {
      // 检查是否是自定义场景且已有预生成的开场白
      const scenario = this.data.scenario;
      const isCustomWithGreeting = scenario && scenario.isCustom && scenario.greeting;

      console.log('Starting session with scenario:', JSON.stringify(this.data.scenario));
      console.log('Retry count:', retryCount);

      const response = await api.chat.start({
        scenario: this.data.scenario,
        level: app.globalData.settings.level,
        turns: this.data.maxTurns,
        speaker: this.data.sessionSettings.speaker || app.globalData.settings.voice || 'Ceylia',  // 优先使用会话设置
        speaking_rate: this.data.sessionSettings.speakingRate || undefined  // 传递精确语速
      });

      console.log('Session started, full response:', response);
      console.log('Response type:', typeof response);
      console.log('Response session_id:', response?.session_id);

      if (!response || !response.session_id) {
        console.error('Invalid session response:', response);
        throw new Error('Invalid session response: missing session_id');
      }

      this.setData({
        sessionId: response.session_id,
        isLoading: false,
        sessionReady: true
      });

      console.log('Session ID set to:', this.data.sessionId);

      // 添加AI开场白 - 自定义场景优先使用预生成的开场白
      const greeting = isCustomWithGreeting ? scenario.greeting : response.greeting;
      const audioUrl = isCustomWithGreeting && scenario.audioUrl ? scenario.audioUrl : response.audio_url;
      const chatTips = response.chat_tips;  // 获取开场白的对话提示

      if (greeting) {
        const greetingMsgId = this.addMessage({
          role: 'assistant',
          content: greeting,
          audioUrl: audioUrl,
          duration: 0, // 添加默认 duration 值
          chatTips: chatTips,  // 传递对话提示
          showTips: chatTips && (chatTips.english || chatTips.chinese) && this.data.learningMode === 'prompt' // 开场白直接显示提示
        });

        // 如果有对话提示，显示提示
        if (chatTips && (chatTips.english || chatTips.chinese)) {
          this.setData({
            currentChatTips: chatTips,
            showChatTips: this.data.learningMode === 'prompt'  // 根据学习模式决定是否显示
          });
        }

        // 处理开场白音频播放
        if (audioUrl) {
          // 保存开场白信息
          this._greetingAudioUrl = audioUrl;
          this._greetingMsgId = greetingMsgId;
          this._greetingPlayed = false;  // 标记开场白是否已播放
          
          // 真机环境下，首次加载尝试自动播放
          // iOS真机在某些情况下可能需要用户交互才能播放
          console.log('准备播放开场白，权限状态:', this.data.audioPermissionGranted);
          
          // 延迟尝试播放，确保页面加载完成
          setTimeout(() => {
            this.tryPlayGreeting(audioUrl, greetingMsgId);
          }, 500);
        }
      }
    } catch (error) {
      console.error('开始会话失败', error);
      console.error('Error details:', error.message, error.stack);

      // 重试机制：最多重试2次
      if (retryCount < 2) {
        console.log(`Retrying session start... (attempt ${retryCount + 2})`);
        wx.showToast({
          title: '正在重试连接...',
          icon: 'loading',
          duration: 1500
        });

        setTimeout(() => {
          this.startSession(retryCount + 1);
        }, 1500);
        return;
      }

      this.setData({
        isLoading: false,
        sessionReady: false
      });

      // 显示错误提示，提供重试选项
      wx.showModal({
        title: '连接失败',
        content: '无法连接到服务器，请检查网络后重试',
        confirmText: '重试',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.startSession(0);
          }
        }
      });

      // 添加模拟开场白（但标记会话未就绪）
      this.addMessage({
        role: 'assistant',
        content: this.getDefaultGreeting(),
        duration: 0 // 添加默认 duration 值
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

  // 尝试播放开场白 - 处理真机首次加载情况
  tryPlayGreeting(audioUrl, msgId) {
    console.log('=== tryPlayGreeting ===');
    console.log('_greetingPlayed:', this._greetingPlayed);
    
    // 如果已经播放过，不再重复播放
    if (this._greetingPlayed) {
      console.log('开场白已播放，跳过');
      return;
    }
    
    // 标记正在尝试播放开场白
    this._greetingPlayed = true;
    
    const fullUrl = audioUrl.startsWith('http') ? audioUrl : `${app.globalData.baseUrl}${audioUrl}`;
    console.log('尝试播放开场白:', fullUrl);
    
    // 直接使用主播放器尝试播放
    this.setData({ playingMessageId: msgId });
    this.updateMessagePlayingState(msgId, true);
    
    // 创建新的音频上下文
    if (this.innerAudioContext) {
      this.innerAudioContext.destroy();
    }
    
    this.innerAudioContext = wx.createInnerAudioContext({
      useWebAudioImplement: true
    });
    this.innerAudioContext.obeyMuteSwitch = false;
    
    const self = this;
    
    this.innerAudioContext.onPlay(() => {
      console.log('开场白开始播放成功');
      self.setData({ 
        audioPermissionGranted: true,
        showGreetingPlayTip: false,
        pendingGreetingAudio: null,
        pendingGreetingMsgId: null
      });
    });
    
    this.innerAudioContext.onEnded(() => {
      console.log('开场白播放结束');
      self.updateMessagePlayingState(msgId, false);
      self.setData({ playingMessageId: null });
    });
    
    this.innerAudioContext.onError((err) => {
      console.log('开场白播放失败，需要用户交互:', err);
      self.updateMessagePlayingState(msgId, false);
      self.setData({ playingMessageId: null });
      
      // 播放失败，显示手动播放提示
      // 重置 _greetingPlayed 以允许用户手动播放
      self._greetingPlayed = false;
      self.setData({
        pendingGreetingAudio: audioUrl,
        pendingGreetingMsgId: msgId,
        showGreetingPlayTip: true
      });
    });
    
    // 设置音频源并播放
    this.innerAudioContext.src = fullUrl;
    this.innerAudioContext.play();
  },

  // 切换输入模式
  toggleInputMode() {
    this.setData({
      inputMode: this.data.inputMode === 'voice' ? 'text' : 'voice'
    });
  },

  // 触摸开始
  onTouchStart(e) {
    console.log('=== onTouchStart ===');
    
    // 如果正在等待权限授权，不处理
    if (this._waitingForRecordPermission) {
      console.log('正在等待权限授权，忽略触摸事件');
      return;
    }
    
    // 保存触摸起始位置
    const touch = e.touches[0];
    this._touchStartY = touch.clientY;
    this._touchStartTime = Date.now();
    this._isTouchCancelled = false;
    
    // 先检查权限，不要设置任何UI状态
    this.checkAndStartRecording();
  },

  // 触摸移动
  onTouchMove(e) {
    // 如果触摸已被取消或正在等待权限，忽略
    if (this._isTouchCancelled || this._waitingForRecordPermission) return;
    
    // 只有在真正录音时才处理移动
    if (!this.data.isRecording) return;
    
    const touch = e.touches[0];
    const moveY = this._touchStartY - touch.clientY;
    const isCancelArea = moveY > 100; // 上滑超过100px进入取消区域
    
    if (isCancelArea !== this.data.isCancelArea) {
      this.setData({ isCancelArea });
      
      // 添加震动反馈
      if (isCancelArea) {
        wx.vibrateShort({ type: 'light' });
      }
    }
  },

  // 触摸结束
  onTouchEnd(e) {
    console.log('=== onTouchEnd ===', 'isRecording:', this.data.isRecording, 'waiting:', this._waitingForRecordPermission);
    
    // 如果触摸已被取消，忽略
    if (this._isTouchCancelled) {
      console.log('触摸已取消，忽略结束事件');
      return;
    }
    
    // 如果正在等待权限授权，标记触摸取消
    if (this._waitingForRecordPermission) {
      console.log('正在等待权限，标记触摸取消');
      this._isTouchCancelled = true;
      return;
    }
    
    // 如果没有在录音，忽略
    if (!this.data.isRecording) {
      console.log('未在录音状态，忽略结束事件');
      return;
    }
    
    if (this.data.isCancelArea) {
      this.cancelRecording();
    } else {
      this.stopRecording();
    }
    
    this.setData({ isCancelArea: false });
  },

  // 检查权限并开始录音
  checkAndStartRecording() {
    console.log('=== checkAndStartRecording ===');
    
    // 检查录音权限
    wx.getSetting({
      success: (res) => {
        console.log('getSetting success, record permission:', res.authSetting['scope.record']);
        
        if (res.authSetting['scope.record']) {
          // 已授权，直接开始录音
          this.doStartRecording();
        } else if (res.authSetting['scope.record'] === false) {
          // 权限被永久拒绝，需要引导用户去设置
          this._isTouchCancelled = true;
          wx.showModal({
            title: '权限提示',
            content: '需要录音权限才能使用语音功能，请在设置中开启',
            confirmText: '去设置',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.openSetting();
              }
            }
          });
        } else {
          // 首次请求权限，设置等待状态
          this._waitingForRecordPermission = true;
          this._isTouchCancelled = true; // 标记当前触摸流程取消
          
          console.log('首次请求录音权限');
          
          // 请求录音权限
          wx.authorize({
            scope: 'scope.record',
            success: () => {
              console.log('录音权限授权成功');
              this._waitingForRecordPermission = false;
              // 权限授权成功，但当前触摸流程已取消
              // 用户需要重新按住录音按钮
              wx.showToast({
                title: '授权成功，请重新按住录音',
                icon: 'none',
                duration: 2000
              });
            },
            fail: (err) => {
              console.log('录音权限授权失败', err);
              this._waitingForRecordPermission = false;
              // 权限被拒绝，显示引导
              wx.showModal({
                title: '权限提示',
                content: '需要录音权限才能使用语音功能',
                confirmText: '去设置',
                cancelText: '取消',
                success: (modalRes) => {
                  if (modalRes.confirm) {
                    wx.openSetting();
                  }
                }
              });
            }
          });
        }
      },
      fail: (err) => {
        console.error('getSetting failed', err);
        // getSetting 失败，尝试直接开始
        this.doStartRecording();
      }
    });
  },

  // 旧方法保留兼容
  startRecording() {
    this.checkAndStartRecording();
  },

  // 执行录音开始
  doStartRecording() {
    console.log('=== doStartRecording ===');
    this.recordingCancelled = false;
    
    // 如果有正在播放的音频，先停止
    this.stopAudio();
    
    // 标记开场白已"处理"（用户已开始交互，不需要再播放开场白）
    this._greetingPlayed = true;
    
    // 用户开始录音也视为交互，可以解锁音频播放权限
    // 注意：不要在这里播放待播放的开场白，避免录音时同时播放音频
    this.setData({ 
      isRecording: true, 
      recordingDuration: 0,
      audioPermissionGranted: true,
      showAudioTip: false,
      showGreetingPlayTip: false,
      // 清除待播放的开场白，因为用户已经开始录音交互
      pendingGreetingAudio: null,
      pendingGreetingMsgId: null
    });
    
    console.log('开始录音...');
    this.recorderManager.start({
      duration: 60000,
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'mp3'
    });
    
    this.startRecordingTimer();
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
    // 用户发送新消息时，隐藏之前的对话提示
    this.hideAllChatTips();
    
    // ★ iOS关键：在用户交互时预先激活音频播放器
    this.preActivateAudioPlayer();

    // 先添加用户语音消息（显示加载状态）
    const userMsgId = this.addMessage({
      role: 'user',
      audioUrl: filePath,
      duration: duration ? Math.ceil(duration / 1000) : 0,
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

    // 用户发送新消息时，隐藏之前的对话提示
    this.hideAllChatTips();
    
    // ★ iOS关键：在用户交互时预先激活音频播放器
    this.preActivateAudioPlayer();

    this.addMessage({
      role: 'user',
      content: text,
      duration: 0 // 添加默认 duration 值
    });

    this.setData({ inputText: '' });
    this.sendToAI(text);
  },

  // 发送到AI
  async sendToAI(text) {
    // 检查session_id是否存在
    if (!this.data.sessionId || !this.data.sessionReady) {
      console.error('Cannot send message: session not ready, sessionId:', this.data.sessionId, 'sessionReady:', this.data.sessionReady);

      // 尝试重新建立会话
      wx.showModal({
        title: '会话未建立',
        content: '是否重新连接服务器？',
        confirmText: '重新连接',
        cancelText: '取消',
        success: (res) => {
          if (res.confirm) {
            this.startSession(0);
          }
        }
      });

      this.setData({ isLoading: false });
      return;
    }

    this.setData({ isLoading: true });

    try {
      console.log('Sending message to AI, session_id:', this.data.sessionId, 'message:', text);

      const response = await api.chat.message({
        session_id: this.data.sessionId,
        message: text,
        speaker: this.data.sessionSettings.speaker || app.globalData.settings.voice || 'Ceylia',  // 优先使用会话设置
        speaking_rate: this.data.sessionSettings.speakingRate || undefined  // 传递精确语速
      });

      console.log('AI response received:', JSON.stringify(response));

      this.setData({
        isLoading: false,
        currentTurn: this.data.currentTurn + 1
      });

      // 添加AI回复
      const aiMsgId = this.addMessage({
        role: 'assistant',
        content: response.reply,
        audioUrl: response.audio_url,
        duration: 0, // 添加默认 duration 值
        feedback: response.feedback,
        chatTips: response.chat_tips,
        // 听力模式下隐藏文本
        hideText: this.data.learningMode === 'listening'
      });

      // 自动播放AI语音回复
      if (response.audio_url) {
        console.log('准备自动播放AI回复音频:', response.audio_url);
        // iOS 真机需要在用户交互上下文中尽快调用播放
        // 使用 wx.nextTick 确保 DOM 更新后立即播放，而不是 setTimeout
        wx.nextTick(() => {
          this.autoPlayAudio(response.audio_url, aiMsgId, response.chat_tips);
        });
      } else {
        console.log('没有收到音频URL，跳过自动播放');
        // 如果没有音频，直接显示对话提示
        if (response.chat_tips && this.data.learningMode === 'prompt') {
          this.showChatTipsForMessage(aiMsgId, response.chat_tips);
        }
      }

      // 检查是否结束
      if (response.session_ended || this.data.currentTurn >= this.data.maxTurns) {
        this.endSession(response.report);
      }
    } catch (error) {
      console.error('发送消息失败', error);
      this.setData({ isLoading: false });

      wx.showToast({
        title: '发送失败，请重试',
        icon: 'none',
        duration: 2000
      });

      // 模拟回复
      this.addMessage({
        role: 'assistant',
        content: "I understand. Could you tell me more about that?",
        duration: 0 // 添加默认 duration 值
      });
    }
  },

  // 添加消息
  addMessage(message) {
    const id = `msg_${Date.now()}`;
    const newMessage = {
      id,
      timestamp: Date.now(),
      duration: 0, // 确保每个消息都有默认的 duration
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

  // ★ iOS关键：预先激活音频播放器
  // 在用户交互时调用，创建并激活音频上下文
  // 这样后续的播放就不需要用户交互了
  preActivateAudioPlayer() {
    console.log('=== 预激活音频播放器 (iOS) ===');
    
    // 标记已激活
    this._audioActivated = true;
    
    // 如果已有播放器，先销毁
    if (this.innerAudioContext) {
      try {
        this.innerAudioContext.destroy();
      } catch (e) {
        console.log('销毁旧音频上下文时出错:', e);
      }
    }
    
    // 创建新的音频上下文
    this.innerAudioContext = wx.createInnerAudioContext({
      useWebAudioImplement: true
    });
    this.innerAudioContext.obeyMuteSwitch = false;
    this.innerAudioContext.volume = 1;
    
    // 标记等待播放
    this._waitingForAudio = true;
    this._audioReadyToPlay = false;
    
    const self = this;
    
    // 设置回调
    this.innerAudioContext.onCanplay(() => {
      console.log('音频可以播放');
      self._audioReadyToPlay = true;
      // 如果有待播放的消息ID，更新状态
      if (self._pendingPlayMessageId) {
        self.setData({ playingMessageId: self._pendingPlayMessageId });
        self.updateMessagePlayingState(self._pendingPlayMessageId, true);
      }
    });
    
    this.innerAudioContext.onPlay(() => {
      console.log('音频开始播放');
      self.setData({ audioPermissionGranted: true, showAudioTip: false });
    });
    
    this.innerAudioContext.onEnded(() => {
      console.log('音频播放结束');
      self._waitingForAudio = false;
      if (self._pendingPlayMessageId) {
        self.updateMessagePlayingState(self._pendingPlayMessageId, false);
        self._pendingPlayMessageId = null;
      }
      self.setData({ playingMessageId: null });
      
      // 播放结束后显示对话提示
      if (self._pendingChatTips && self.data.learningMode === 'prompt') {
        self.showChatTipsForMessage(self._pendingMessageId, self._pendingChatTips);
        self._pendingChatTips = null;
        self._pendingMessageId = null;
      }
    });
    
    this.innerAudioContext.onError((err) => {
      console.error('音频播放错误:', err);
      self._waitingForAudio = false;
      if (self._pendingPlayMessageId) {
        self.updateMessagePlayingState(self._pendingPlayMessageId, false);
        self._pendingPlayMessageId = null;
      }
      self.setData({ playingMessageId: null });
    });
    
    // ★ 关键：使用一个极短的静音音频激活播放器
    // 这个 base64 是一个极短的静音 WAV 文件
    const silentAudio = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
    this.innerAudioContext.src = silentAudio;
    
    // 尝试播放静音音频来激活
    try {
      this.innerAudioContext.play();
      console.log('静音音频已播放，音频播放器已激活');
    } catch (e) {
      console.log('激活播放失败:', e);
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
    console.log('音频已激活:', this._audioActivated);
    
    // 确保使用完整的URL
    const fullUrl = audioUrl.startsWith('http') ? audioUrl : `${app.globalData.baseUrl}${audioUrl}`;
    
    // 保存待播放信息
    this._pendingPlayMessageId = messageId;
    if (chatTips) {
      this._pendingChatTips = chatTips;
      this._pendingMessageId = messageId;
    }
    
    // 更新UI状态
    this.setData({ playingMessageId: messageId });
    this.updateMessagePlayingState(messageId, true);
    
    // 如果有预激活的播放器，直接使用
    if (this._audioActivated && this.innerAudioContext) {
      console.log('使用预激活的播放器播放');
      this.innerAudioContext.src = fullUrl;
      // 播放器已经激活，直接播放
      try {
        this.innerAudioContext.play();
      } catch (e) {
        console.error('播放失败:', e);
        // 回退到直接播放方法
        this.directPlayAudio(fullUrl, messageId, chatTips);
      }
    } else {
      // 没有预激活，使用直接播放方法
      console.log('没有预激活的播放器，使用直接播放');
      this.directPlayAudio(fullUrl, messageId, chatTips);
    }
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
      try {
        this.innerAudioContext.destroy();
      } catch (e) {
        console.log('销毁旧音频上下文时出错:', e);
      }
    }
    
    this.innerAudioContext = wx.createInnerAudioContext({
      useWebAudioImplement: true
    });
    this.innerAudioContext.obeyMuteSwitch = false;
    
    const self = this;
    
    // 设置播放回调
    this.innerAudioContext.onPlay(() => {
      console.log('音频开始播放');
      self.setData({ audioPermissionGranted: true, showAudioTip: false });
    });
    
    this.innerAudioContext.onEnded(() => {
      console.log('音频播放结束');
      self.updateMessagePlayingState(messageId, false);
      self.setData({ playingMessageId: null });
      
      // 播放结束后显示对话提示
      if (self._pendingChatTips && self.data.learningMode === 'prompt') {
        self.showChatTipsForMessage(self._pendingMessageId, self._pendingChatTips);
        self._pendingChatTips = null;
        self._pendingMessageId = null;
      }
    });
    
    this.innerAudioContext.onError((err) => {
      console.error('音频播放错误:', err);
      console.error('错误详情:', JSON.stringify(err));
      self.updateMessagePlayingState(messageId, false);
      self.setData({ playingMessageId: null });
      
      // iOS 真机可能因为自动播放限制失败，尝试重新播放
      if (err.errCode === 10003 || (err.errMsg && err.errMsg.includes('abort'))) {
        console.log('可能是自动播放被阻止，稍后重试');
        // 保存待播放信息，用户下次交互时播放
        self._pendingAutoPlayAudio = {
          audioUrl: fullUrl,
          messageId: messageId,
          chatTips: chatTips
        };
      }
    });
    
    // 设置音频源并播放
    console.log('设置音频源:', fullUrl);
    this.innerAudioContext.src = fullUrl;
    
    // iOS 真机需要确保在用户交互上下文中调用 play
    // 由于这是在用户发送消息后的响应，应该是有效的交互上下文
    try {
      this.innerAudioContext.play();
    } catch (e) {
      console.error('播放调用失败:', e);
    }
    
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

  // 点击单词查看翻译（简化版本）
  onWordTap(e) {
    const { word } = e.detail;
    // 简单显示单词，不提供字典查询和生词本功能
    wx.showToast({ 
      title: `You clicked: ${word}`, 
      icon: 'none',
      duration: 1500
    });
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
    // 重置音频激活状态
    this._audioActivated = false;
    this._waitingForAudio = false;
    this._pendingPlayMessageId = null;
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
          showTips: mode === 'prompt' && msg.chatTips && (msg.chatTips.english || msg.chatTips.chinese) // 在提示模式下显示有提示的消息
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

  // 隐藏所有消息的对话提示
  hideAllChatTips() {
    const messages = this.data.messages.map(msg => {
      if (msg.showTips) {
        return { ...msg, showTips: false };
      }
      return msg;
    });
    this.setData({
      messages,
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
    
    // 如果开场白已经播放过，也无需预解锁
    if (this._greetingPlayed) {
      console.log('开场白已播放，无需预解锁');
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
        
        // 预解锁成功后，如果有待播放的开场白且还没播放过，则播放
        // 注意：这里不再调用 playPendingGreetingAudio，避免重复播放
        // 开场白的播放由 tryPlayGreeting 统一管理
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
    const { pendingGreetingAudio, pendingGreetingMsgId, isRecording } = this.data;
    
    // 如果正在录音，不播放开场白
    if (isRecording) {
      console.log('正在录音，跳过开场白播放');
      return;
    }
    
    // 如果开场白已经播放过，不再重复
    if (this._greetingPlayed) {
      console.log('开场白已播放过，跳过');
      return;
    }
    
    if (pendingGreetingAudio && pendingGreetingMsgId) {
      console.log('播放待播放的开场白音频:', pendingGreetingAudio);
      
      // 标记开场白已播放
      this._greetingPlayed = true;
      
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
    
    // 标记已获得权限和开场白将要播放
    this._greetingPlayed = true;
    this.setData({ 
      audioPermissionGranted: true,
      showGreetingPlayTip: false
    });
    
    // 获取待播放信息
    const audioUrl = this.data.pendingGreetingAudio || this._greetingAudioUrl;
    const msgId = this.data.pendingGreetingMsgId || this._greetingMsgId;
    
    if (audioUrl && msgId) {
      // 清除待播放状态
      this.setData({
        pendingGreetingAudio: null,
        pendingGreetingMsgId: null
      });
      
      // 直接播放
      this.directPlayAudio(audioUrl, msgId, null);
    }
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
  },

  // 会话未就绪时的提示
  onSessionNotReady() {
    wx.showModal({
      title: '会话未建立',
      content: '正在连接服务器，是否重试？',
      confirmText: '重试',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          this.startSession(0);
        }
      }
    });
  }
});
