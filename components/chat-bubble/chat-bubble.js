Component({
  properties: {
    content: {
      type: String,
      value: ''
    },
    role: {
      type: String,
      value: 'assistant' // assistant | user
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
    }
  }
});
