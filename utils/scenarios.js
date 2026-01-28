/**
 * 场景配置映射
 * 基于LangCoach实际支持的场景
 */

const SCENARIOS = {
  // 职场英语场景
  job_interview: {
    id: 'job_interview',
    name: '技术面试',
    title: 'Internet R&D Engineer Interview',
    description: '互联网研发工程师职位面试模拟',
    category: 'professional',
    difficulty: 'B2',
    estimatedTime: 15,
    icon: '👔',
    prompt_file: 'job_interview_prompt.j2',
    tags: ['面试', '技术', '研发', '工程师']
  },

  salary_negotiation: {
    id: 'salary_negotiation', 
    name: '薪资谈判',
    title: 'Salary Negotiation with HR',
    description: '与HR进行薪资待遇协商谈判',
    category: 'professional',
    difficulty: 'C1',
    estimatedTime: 12,
    icon: '💰',
    prompt_file: 'salary_negotiation_prompt.j2',
    tags: ['谈判', '薪资', 'HR', '职场']
  },

  // 生活英语场景
  hotel_checkin: {
    id: 'hotel_checkin',
    name: '酒店入住',
    title: 'Hotel Check-in Process',
    description: '酒店前台办理入住手续对话',
    category: 'daily_life',
    difficulty: 'B1',
    estimatedTime: 8,
    icon: '🏨',
    prompt_file: 'hotel_checkin_prompt.j2',
    tags: ['酒店', '旅行', '服务', '入住']
  },

  renting: {
    id: 'renting',
    name: '租房咨询',
    title: 'Apartment Rental Inquiry',
    description: '与房东或中介讨论租房事宜',
    category: 'daily_life',
    difficulty: 'B1',
    estimatedTime: 10,
    icon: '🏠',
    prompt_file: 'renting_prompt.j2',
    tags: ['租房', '房屋', '中介', '生活']
  }
};

// 按分类组织场景
const CATEGORIES = {
  professional: {
    id: 'professional',
    name: '职场英语',
    icon: '💼',
    color: '#4A90D9',
    scenarios: ['job_interview', 'salary_negotiation']
  },

  daily_life: {
    id: 'daily_life', 
    name: '生活英语',
    icon: '🏠',
    color: '#52C41A',
    scenarios: ['hotel_checkin', 'renting']
  }
};

// 快速练习场景
const QUICK_SCENARIOS = [
  {
    id: 'random',
    name: '随机挑战',
    icon: '🎲',
    color: '#9B59B6',
    description: '从所有场景中随机选择一个进行练习'
  },
  {
    id: 'roleplay',
    name: '角色互换',
    icon: '🔄',
    color: '#3498DB',
    description: '在对话中交换角色，提升理解能力'
  }
];

// 难度等级配置
const DIFFICULTY_LEVELS = {
  'A1': { name: '初级', color: '#52C41A', description: '基础语法和简单对话' },
  'A2': { name: '初中级', color: '#52C41A', description: '日常交流和基本表达' },
  'B1': { name: '中级', color: '#FAAD14', description: '日常对话和基本商务' },
  'B2': { name: '中高级', color: '#FAAD14', description: '复杂话题和专业讨论' },
  'C1': { name: '高级', color: '#FF4D4F', description: '流利表达和复杂语法' },
  'C2': { name: '精通', color: '#FF4D4F', description: '母语水平的理解和表达' }
};

// 工具函数
const ScenarioUtils = {
  // 获取场景信息
  getScenario(id) {
    return SCENARIOS[id] || null;
  },

  // 获取分类信息
  getCategory(id) {
    return CATEGORIES[id] || null;
  },

  // 获取分类下的所有场景
  getCategoryScenarios(categoryId) {
    const category = CATEGORIES[categoryId];
    if (!category) return [];
    
    return category.scenarios.map(scenarioId => SCENARIOS[scenarioId]).filter(Boolean);
  },

  // 获取所有场景列表
  getAllScenarios() {
    return Object.values(SCENARIOS);
  },

  // 获取随机场景
  getRandomScenario() {
    const scenarios = Object.values(SCENARIOS);
    return scenarios[Math.floor(Math.random() * scenarios.length)];
  },

  // 根据难度筛选场景
  getScenariosByDifficulty(difficulty) {
    return Object.values(SCENARIOS).filter(scenario => 
      scenario.difficulty === difficulty || 
      scenario.difficulty.includes(difficulty)
    );
  }
};

module.exports = {
  SCENARIOS,
  CATEGORIES,
  QUICK_SCENARIOS,
  DIFFICULTY_LEVELS,
  ScenarioUtils
};