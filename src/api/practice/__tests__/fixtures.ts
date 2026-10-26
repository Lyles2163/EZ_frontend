// src/api/practice/__tests__/fixtures.ts
/**
 * 逐字抄自后端端到端取证落盘的响应体（ezPracticeExercises 仓库外
 * `…/.qoder-cn/tmp/F--AAAJAVA-code-ezPracticeExercises/seg3/resp-*.json`），不改一个字符。
 * 抄字面量而不是读文件：那个目录是 gitignored 的临时区，测试不能依赖它存在。
 */

export const SUBJECT_LIST_OK = [
  {
    id: 1, name: '语文', subjectKey: 'chinese', icon: 'icon-chinese', description: '语文题库测试科目',
    questionCount: 4, myTotal: 10, myCorrect: 7, myAccuracy: 0.7, lastAnswerAt: 1792805141000,
  },
  {
    id: 2, name: '数学', subjectKey: 'math', icon: 'icon-math', description: '数学题库测试科目',
    questionCount: 3, myTotal: 2, myCorrect: 2, myAccuracy: 1.0, lastAnswerAt: 1792740125000,
  },
]

export const QUESTION_CURRENT_OK = {
  finished: false,
  question: {
    questionId: 7, subjectId: 2, type: 1, typeName: '单选题',
    title: '这是用户 bob 的私有题，哪个正确？',
    options: [
      { optionKey: 'A', content: '用户3选项A' },
      { optionKey: 'B', content: '用户3选项B' },
      { optionKey: 'C', content: '用户3选项C' },
      { optionKey: 'D', content: '用户3选项D' },
    ],
    difficulty: 1, tags: ['私有', '用户3'], index: 2, score: null,
  },
  answerStatus: 2, lastUserAnswerJson: '"A"', pendingRecordId: null,
}

export const QUESTION_CURRENT_FINISHED = {
  finished: true, question: null, answerStatus: null,
  lastUserAnswerJson: null, pendingRecordId: null,
}

export const SUBMIT_WRONG_OK = {
  recordId: 38, isCorrect: false, correctAnswerJson: '"C"', analysis: 'C 是正确选项。',
  needSelfJudge: false, statDelta: { total: 3, correct: 2, wrong: 1, accuracy: 0.67 },
  wrongCount: 1, wrongMastered: false,
}

/** 简答题提交后的真实形态：isCorrect 是 null，但 correctAnswerJson 照样有值（裁定七针对的就是它） */
export const SUBMIT_PENDING_OK = {
  recordId: 99, isCorrect: null, correctAnswerJson: '"我的简答"', analysis: '略',
  needSelfJudge: true, statDelta: { total: 4, correct: 2, wrong: 1, accuracy: 0.67 },
  wrongCount: 0, wrongMastered: false,
}

export const SELF_JUDGE_OK = { statDelta: { total: 11, correct: 8, wrong: 3, accuracy: 0.73 } }

export const WRONG_PAGE_OK = {
  pageNum: 1, pageSize: 20, total: 1, pages: 1,
  list: [{
    questionId: 7, index: 2, type: 1, titleBrief: '这是用户 bob 的私有题，哪个正确？',
    wrongCount: 1, lastWrongAt: 1792811456000, status: 1, lastUserAnswerJson: '"A"',
  }],
}

export const WRONG_PAGE_EMPTY = { pageNum: 1, pageSize: 20, total: 0, pages: 0, list: [] }

export const FAVORITE_PAGE_OK = {
  pageNum: 1, pageSize: 20, total: 1, pages: 1,
  list: [{ questionId: 1, index: 1, type: 1, titleBrief: '下列选项中，正确的是？', createdAt: 1792811457000 }],
}

/** question/page 的 list 元素刻意没有 title */
export const QUESTION_PAGE_OK = {
  pageNum: 1, pageSize: 100, total: 2, pages: 1,
  list: [
    { index: 1, questionId: 1, type: 1, difficulty: 1, tags: [], answerStatus: 0, favorited: false },
    { index: 2, questionId: 6, type: 5, difficulty: 2, tags: ['简答'], answerStatus: 3, favorited: true },
  ],
}

export const FAVORITE_TOGGLE_OK = { favorited: true }
