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
      // 尝试主动检测音频播放权限
      this.detectAudioPermission();
    }
  },

  // 检测音频播放权限
  detectAudioPermission() {
    console.log('开始检测音频播放权限...');
    
    // 创建一个临时音频播放器测试权限
    const testAudio = wx.createInnerAudioContext({
      useWebAudioImplement: true
    });
    testAudio.src = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+HwymMcBDyS2e/MdSEIL3v47lUCWZ2+eR==';
    testAudio.volume = 0; // 静音测试
    testAudio.obeyMuteSwitch = false;
    
    testAudio.onPlay(() => {
      console.log('音频播放权限检测成功 - 可以自动播放');
      this.setData({ audioPermissionGranted: true });
      testAudio.destroy();
    });
    
    testAudio.onError((err) => {
      console.log('音频播放权限检测失败:', err);
      // 权限未获得，需要用户交互
      testAudio.destroy();
    });
    
    // 尝试播放测试音频
    try {
      testAudio.play();
      
      // 2秒后清理，防止内存泄漏
      setTimeout(() => {
        try {
          testAudio.destroy();
        } catch (e) {
          // 忽略销毁错误
        }
      }, 2000);
      
    } catch (err) {
      console.log('创建测试音频失败:', err);
      testAudio.destroy();
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
      
      // 播放成功，清除待播放状态和提示
      const messageId = this._currentPlayingMessageId;
      this.setData({ 
        showAudioTip: false,
        showGreetingPlayTip: false,
        // 如果当前播放的是开场白，清除待播放状态
        pendingGreetingAudio: this.data.pendingGreetingMsgId === messageId ? null : this.data.pendingGreetingAudio,
        pendingGreetingMsgId: this.data.pendingGreetingMsgId === messageId ? null : this.data.pendingGreetingMsgId
      });
    });

    this.innerAudioContext.onEnded(() => {
      console.log('音频播放结束');
      const messageId = this._currentPlayingMessageId;
      if (messageId) {
        this.updateMessagePlayingState(messageId, false);
      }
      this.setData({ playingMessageId: null });
      this._currentPlayingMessageId = null;
      
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
      
      const messageId = this._currentPlayingMessageId;
      if (messageId) {
        this.updateMessagePlayingState(messageId, false);
      }
      this.setData({ playingMessageId: null });
      this._currentPlayingMessageId = null;
      
      // 检查是否为权限相关错误或需要用户交互
      if (err.errCode === 10003 || err.errMsg.includes('interrupted') || err.errMsg.includes('NotAllowed') || err.errMsg.includes('play() failed')) {
        console.log('可能是音频权限问题，显示提示');
        this.setData({ showAudioTip: true });
        // 如果是开场白播放失败，设置待播放状态
        if (this.data.pendingGreetingMsgId === messageId) {
          this.setData({ showGreetingPlayTip: true });
        }
      } else if (err.errCode !== -1) { // -1 通常是用户主动停止
        // 显示更详细的错误信息
        const errorMessages = {
          10001: '系统错误',
          10002: '网络错误',
          10003: '文件错误',
          10004: '格式错误'
        };
        const errorMsg = errorMessages[err.errCode] || '播放失败';
        console.log('播放错误:', errorMsg);
      }
    });

    this.innerAudioContext.onStop(() => {
      console.log('音频播放停止');
      const messageId = this._currentPlayingMessageId;
      if (messageId) {
        this.updateMessagePlayingState(messageId, false);
      }
      this.setData({ playingMessageId: null });
      this._currentPlayingMessageId = null;
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
      sessionId: null,
      sessionReady: false
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
        speaker: app.globalData.settings.voice || 'Ceylia'  // 添加语音角色参数
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
          console.log('准备播放开场白音频:', audioUrl);
          
          // 保存开场白音频信息，用于后续可能的手动播放
          this.setData({
            pendingGreetingAudio: audioUrl,
            pendingGreetingMsgId: greetingMsgId
          });
          
          // 检测环境
          const systemInfo = wx.getSystemInfoSync();
          const isIOS = systemInfo.platform === 'ios';
          const isDevTools = systemInfo.platform === 'devtools';
          
          console.log('播放环境:', systemInfo.platform);
          
          if (isDevTools) {
            // 开发工具中直接播放
            setTimeout(() => {
              this.autoPlayAudio(audioUrl, greetingMsgId, chatTips);
            }, 500);
          } else if (isIOS) {
            // iOS 真机：先尝试播放，同时准备显示提示
            setTimeout(() => {
              this.autoPlayAudio(audioUrl, greetingMsgId, chatTips);
              
              // iOS 上 1 秒后检查是否需要显示提示
              setTimeout(() => {
                if (this.data.pendingGreetingAudio) {
                  console.log('iOS 自动播放可能失败，显示点击播放提示');
                  this.setData({ showGreetingPlayTip: true });
                }
              }, 1000);
            }, 300);
          } else {
            // Android 真机
            setTimeout(() => {
              this.autoPlayAudio(audioUrl, greetingMsgId, chatTips);
              
              // 2秒后检查是否播放成功
              setTimeout(() => {
                if (this.data.pendingGreetingAudio) {
                  console.log('自动播放可能失败，显示用户引导');
                  this.setData({ showGreetingPlayTip: true });
                }
              }, 2000);
            }, 500);
          }
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
    // 如果正在录音，忽略
    if (this.data.isRecording) {
      console.log('已在录音中，忽略触摸');
      return;
    }
    
    // 保存触摸信息用于后续使用
    const touch = e.touches[0];
    this._touchStartY = touch.clientY;
    this._touchStartTime = Date.now();
    
    // 检查录音权限
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.record']) {
          // 已有权限，设置触摸位置并开始录音
          this.setData({
            touchStartY: this._touchStartY,
            isCancelArea: false
          });
          this.doStartRecording();
        } else {
          // 没有权限，显示授权弹窗
          // 注意：不设置任何录音相关状态，避免界面卡住
          console.log('需要请求录音权限');
          this.requestRecordPermission();
        }
      },
      fail: (err) => {
        console.error('获取设置失败:', err);
      }
    });
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
    // 清理临时触摸信息
    this._touchStartY = 0;
    this._touchStartTime = 0;
    
    // 如果没有在录音，直接返回
    if (!this.data.isRecording) {
      return;
    }
    
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
    // 检查录音权限
    wx.getSetting({
      success: (res) => {
        if (res.authSetting['scope.record']) {
          // 已授权，直接开始录音
          this.doStartRecording();
        } else {
          // 请求录音权限
          this.requestRecordPermission();
        }
      },
      fail: (err) => {
        console.error('获取设置失败:', err);
      }
    });
  },

  // 请求录音权限
  requestRecordPermission() {
    wx.authorize({
      scope: 'scope.record',
      success: () => {
        console.log('录音权限授权成功');
        // 授权成功后，标记音频权限已获取（用户已交互）
        this.setData({ audioPermissionGranted: true, showGreetingPlayTip: false });
        // 不自动开始录音，等待用户再次点击
        wx.showToast({ title: '授权成功，请再次点击录音', icon: 'none', duration: 1500 });
      },
      fail: () => {
        console.log('录音权限授权失败');
        wx.showModal({
          title: '权限提示',
          content: '需要录音权限才能使用语音功能',
          success: (res) => {
            if (res.confirm) {
              wx.openSetting({
                success: (settingRes) => {
                  console.log('设置结果:', settingRes.authSetting);
                  if (settingRes.authSetting['scope.record']) {
                    // 用户在设置中开启了权限
                    this.setData({ audioPermissionGranted: true, showGreetingPlayTip: false });
                    wx.showToast({ title: '授权成功，请再次点击录音', icon: 'none', duration: 1500 });
                  }
                }
              });
            }
          }
        });
      }
    });
  },

  // 执行录音开始
  doStartRecording() {
    // 停止任何正在播放的音频
    if (this.innerAudioContext) {
      try {
        this.innerAudioContext.stop();
      } catch (e) {
        console.log('停止音频时出错:', e);
      }
    }
    
    this.recordingCancelled = false;
    // 用户开始录音也视为交互，可以解锁音频播放权限
    this.setData({ 
      isRecording: true, 
      recordingDuration: 0,
      audioPermissionGranted: true,
      showAudioTip: false,
      showGreetingPlayTip: false,
      // 清除待播放的开场白，避免重复播放
      pendingGreetingAudio: null,
      pendingGreetingMsgId: null,
      // 清除播放状态
      playingMessageId: null
    });
    
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

    // 用户发送新消息时，隐藏之前的对话提示
    this.hideAllChatTips();

    this.addMessage({
      role: 'user',
      content: text
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
        speaker: app.globalData.settings.voice || 'Ceylia'  // 使用用户选择的语音角色
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
    console.log('音频权限状态:', this.data.audioPermissionGranted);
    
    // 如果已经有音频权限，直接播放
    if (this.data.audioPermissionGranted) {
      console.log('已有音频权限，直接播放');
      this.directPlayAudio(audioUrl, messageId, chatTips);
    } else {
      // 没有权限，先尝试播放，失败后显示提示
      console.log('尝试播放（可能需要用户交互）');
      this.directPlayAudio(audioUrl, messageId, chatTips);
    }
  },

  // 直接播放音频的方法
  directPlayAudio(audioUrl, messageId, chatTips) {
    // 确保使用完整的URL
    const fullUrl = audioUrl.startsWith('http') ? audioUrl : `${app.globalData.baseUrl}${audioUrl}`;
    
    console.log('=== 直接播放音频 ===');
    console.log('完整URL:', fullUrl);
    console.log('当前音频权限状态:', this.data.audioPermissionGranted);
    
    // 更新状态
    this.setData({ playingMessageId: messageId });
    this.updateMessagePlayingState(messageId, true);
    
    // 保存当前播放信息用于回调
    this._currentPlayingMessageId = messageId;
    this._currentChatTips = chatTips;
    
    // 如果是提示模式且有对话提示，在播放完成后显示
    if (this.data.learningMode === 'prompt' && chatTips) {
      this._pendingChatTips = chatTips;
      this._pendingMessageId = messageId;
    }
    
    // 重新创建音频上下文来解决 iOS 真机播放问题
    this.playWithNewContext(fullUrl, messageId);
  },
  
  // 使用新的音频上下文播放（解决 iOS 真机问题）
  playWithNewContext(fullUrl, messageId) {
    // 销毁旧的音频上下文
    if (this.innerAudioContext) {
      try {
        this.innerAudioContext.stop();
        this.innerAudioContext.destroy();
      } catch (e) {
        console.log('销毁旧音频上下文失败:', e);
      }
    }
    
    // 创建新的音频上下文
    this.innerAudioContext = wx.createInnerAudioContext({
      useWebAudioImplement: true
    });
    this.innerAudioContext.obeyMuteSwitch = false;
    
    // 设置回调
    this.innerAudioContext.onPlay(() => {
      console.log('音频开始播放 - messageId:', messageId);
      this.setData({ 
        audioPermissionGranted: true,
        showAudioTip: false,
        showGreetingPlayTip: false,
        pendingGreetingAudio: this.data.pendingGreetingMsgId === messageId ? null : this.data.pendingGreetingAudio,
        pendingGreetingMsgId: this.data.pendingGreetingMsgId === messageId ? null : this.data.pendingGreetingMsgId
      });
    });
    
    this.innerAudioContext.onEnded(() => {
      console.log('音频播放结束 - messageId:', messageId);
      this.updateMessagePlayingState(messageId, false);
      this.setData({ playingMessageId: null });
      this._currentPlayingMessageId = null;
      
      if (this._pendingChatTips && this.data.learningMode === 'prompt') {
        this.showChatTipsForMessage(this._pendingMessageId, this._pendingChatTips);
        this._pendingChatTips = null;
        this._pendingMessageId = null;
      }
    });
    
    this.innerAudioContext.onError((err) => {
      console.error('音频播放错误:', err.errCode, err.errMsg);
      this.updateMessagePlayingState(messageId, false);
      this.setData({ playingMessageId: null });
      this._currentPlayingMessageId = null;
      
      // 如果是权限问题，显示提示
      if (err.errCode === 10003 || err.errMsg.includes('NotAllowed') || err.errMsg.includes('play() failed') || err.errMsg.includes('interrupted')) {
        console.log('iOS 音频权限问题，显示播放提示');
        if (this.data.pendingGreetingMsgId === messageId || !this.data.audioPermissionGranted) {
          this.setData({ showGreetingPlayTip: true });
        }
      }
    });
    
    this.innerAudioContext.onCanplay(() => {
      console.log('音频可以播放了');
    });
    
    // 设置音频源
    console.log('设置音频源:', fullUrl);
    this.innerAudioContext.src = fullUrl;
    
    // 直接尝试播放 - 如果用户已经交互过，这应该能工作
    // 使用很短的延迟确保 src 已设置
    setTimeout(() => {
      console.log('尝试播放音频, audioPermissionGranted:', this.data.audioPermissionGranted);
      try {
        this.innerAudioContext.play();
      } catch (e) {
        console.error('播放调用失败:', e);
      }
    }, 50);
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

  // 点击开场白播放提示
  onGreetingPlayTap() {
    if (this.data.pendingGreetingAudio && this.data.pendingGreetingMsgId) {
      this.setData({ 
        audioPermissionGranted: true,
        showGreetingPlayTip: false 
      });
      this.autoPlayAudio(this.data.pendingGreetingAudio, this.data.pendingGreetingMsgId);
      // 清除待播放状态
      this.setData({
        pendingGreetingAudio: null,
        pendingGreetingMsgId: null
      });
    }
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
        // 预解锁成功，不再自动播放开场白（避免重复播放）
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
      
      // 先保存引用，再清除状态
      const audioUrl = pendingGreetingAudio;
      const msgId = pendingGreetingMsgId;
      
      // 清除待播放状态
      this.setData({
        pendingGreetingAudio: null,
        pendingGreetingMsgId: null,
        showGreetingPlayTip: false
      });
      
      // 在用户点击事件中直接播放（iOS 需要同步触发）
      this.directPlayAudio(audioUrl, msgId, null);
    }
  },

  // 点击播放开场白提示
  onGreetingPlayTap() {
    console.log('用户点击播放开场白');
    
    const { pendingGreetingAudio, pendingGreetingMsgId } = this.data;
    
    if (!pendingGreetingAudio || !pendingGreetingMsgId) {
      console.log('没有待播放的开场白');
      this.setData({ showGreetingPlayTip: false });
      return;
    }
    
    // 保存引用
    const audioUrl = pendingGreetingAudio;
    const msgId = pendingGreetingMsgId;
    
    // 标记已获得权限并清除状态
    this.setData({ 
      audioPermissionGranted: true,
      showGreetingPlayTip: false,
      pendingGreetingAudio: null,
      pendingGreetingMsgId: null
    });
    
    // 在点击事件中直接播放（iOS 要求同步触发）
    this.directPlayAudio(audioUrl, msgId, null);
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
