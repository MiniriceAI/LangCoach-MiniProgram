Component({
  properties: {
    word: {
      type: String,
      value: ''
    },
    phonetic: {
      type: String,
      value: ''
    },
    definition: {
      type: String,
      value: ''
    },
    showAnswer: {
      type: Boolean,
      value: false
    }
  },

  data: {
    flipped: false
  },

  methods: {
    flip() {
      this.setData({ flipped: !this.data.flipped });
      this.triggerEvent('flip', { flipped: this.data.flipped });
    },

    markLearned() {
      this.triggerEvent('learned', { word: this.data.word });
    },

    playAudio() {
      // 播放单词发音
      this.triggerEvent('playaudio', { word: this.data.word });
    }
  }
});
