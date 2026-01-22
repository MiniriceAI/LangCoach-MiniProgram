Component({
  properties: {
    content: {
      type: String,
      value: ''
    },
    role: {
      type: String,
      value: 'assistant' // assistant | user
    },
    type: {
      type: String,
      value: 'text' // text | voice
    },
    audioUrl: {
      type: String,
      value: ''
    },
    duration: {
      type: Number,
      value: 0
    },
    transcribing: {
      type: Boolean,
      value: false
    },
    error: {
      type: Boolean,
      value: false
    },
    playing: {
      type: Boolean,
      value: false
    }
  },

  data: {
    words: []
  },

  observers: {
    'content': function(content) {
      if (content) {
        this.parseContent(content);
      }
    }
  },

  methods: {
    parseContent(content) {
      // 将文本分割成单词和标点
      const words = content.split(/(\s+|[,.!?;:'"()[\]{}])/g).filter(w => w);
      this.setData({ words });
    },

    onWordTap(e) {
      const { word } = e.currentTarget.dataset;
      // 只对英文单词触发事件
      if (/^[a-zA-Z]+$/.test(word) && word.length > 1) {
        this.triggerEvent('wordtap', { word: word.toLowerCase() });
      }
    },

    onAudioTap() {
      if (this.properties.audioUrl && !this.properties.transcribing && !this.properties.error) {
        this.triggerEvent('audiotap', {
          audioUrl: this.properties.audioUrl,
          playing: this.properties.playing,
          role: this.properties.role
        });
      }
    },

    // 设置播放状态
    setPlayingState(playing) {
      this.setData({
        playing: playing
      });
    }
  }
});
