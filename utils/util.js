/**
 * 工具函数集合
 */

/**
 * 格式化时间戳
 * @param {number} timestamp - 时间戳
 * @returns {string} 格式化后的时间字符串
 */
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now - date;

  // 1分钟内
  if (diff < 60000) {
    return '刚刚';
  }
  // 1小时内
  if (diff < 3600000) {
    return `${Math.floor(diff / 60000)}分钟前`;
  }
  // 今天
  if (date.toDateString() === now.toDateString()) {
    return `${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
  }
  // 昨天
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return `昨天 ${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
  }
  // 更早
  return `${date.getMonth() + 1}/${date.getDate()} ${padZero(date.getHours())}:${padZero(date.getMinutes())}`;
}

/**
 * 补零
 */
function padZero(num) {
  return num < 10 ? `0${num}` : `${num}`;
}

/**
 * 格式化日期
 * @param {Date|string|number} date - 日期
 * @param {string} format - 格式
 * @returns {string}
 */
function formatDate(date, format = 'YYYY-MM-DD') {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = padZero(d.getMonth() + 1);
  const day = padZero(d.getDate());
  const hour = padZero(d.getHours());
  const minute = padZero(d.getMinutes());
  const second = padZero(d.getSeconds());

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hour)
    .replace('mm', minute)
    .replace('ss', second);
}

/**
 * 格式化时长（秒）
 * @param {number} seconds - 秒数
 * @returns {string}
 */
function formatDuration(seconds) {
  if (seconds < 60) {
    return `${seconds}秒`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}小时${remainingMinutes}分钟`;
}

/**
 * 防抖函数
 * @param {Function} fn - 要防抖的函数
 * @param {number} delay - 延迟时间
 * @returns {Function}
 */
function debounce(fn, delay = 300) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delay);
  };
}

/**
 * 节流函数
 * @param {Function} fn - 要节流的函数
 * @param {number} interval - 间隔时间
 * @returns {Function}
 */
function throttle(fn, interval = 300) {
  let lastTime = 0;
  return function (...args) {
    const now = Date.now();
    if (now - lastTime >= interval) {
      lastTime = now;
      fn.apply(this, args);
    }
  };
}

/**
 * 生成唯一ID
 * @returns {string}
 */
function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 获取难度等级颜色
 * @param {string} level - 难度等级
 * @returns {string}
 */
function getLevelColor(level) {
  const colors = {
    'A1': '#52C41A',
    'A2': '#52C41A',
    'B1': '#FAAD14',
    'B2': '#FAAD14',
    'C1': '#FF4D4F',
    'C2': '#FF4D4F'
  };
  return colors[level] || '#999999';
}

/**
 * 获取分数颜色
 * @param {number} score - 分数
 * @returns {string}
 */
function getScoreColor(score) {
  if (score >= 90) return '#52C41A';
  if (score >= 70) return '#FAAD14';
  return '#FF4D4F';
}

/**
 * 深拷贝
 * @param {any} obj - 要拷贝的对象
 * @returns {any}
 */
function deepClone(obj) {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(item => deepClone(item));
  }
  const cloned = {};
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      cloned[key] = deepClone(obj[key]);
    }
  }
  return cloned;
}

module.exports = {
  formatTime,
  formatDate,
  formatDuration,
  debounce,
  throttle,
  generateId,
  getLevelColor,
  getScoreColor,
  deepClone,
  padZero
};
