import { writable, derived, get } from 'svelte/store'
import { taskService, historyService, settingsService, urgencyCalculator, initializeDatabase } from './db.js'

// 基本的なストア
export const tasks = writable([])
export const history = writable([])
export const settings = writable({})
export const loading = writable(false)
export const error = writable(null)

// UI状態管理
export const currentView = writable('main') // 'main' | 'history' | 'settings'
export const selectedTaskType = writable('all') // 'all' | 'work' | 'home' | 'skill'
export const showCompletedTasks = writable(false)

// フォーム関連の状態
export const taskForm = writable({
  type: 'work',
  name: '',
  due_date: '',
  importance: 5,
  effort_hours: 1,
  parent_id: null
})

// 編集モード関連の状態
export const editMode = writable({
  isEditing: false,
  editingTaskId: null,
  taskType: 'task', // 'task' | 'subtask'
  isAddingSubtask: false,
  parentTaskId: null
})

// 設定フォーム
export const settingsForm = writable({
  urgency_formula: '',
  urgency_thresholds: { high: 10, medium: 3 }
})

// 緊急性付きタスクの派生ストア
export const tasksWithUrgency = derived(
  [tasks],
  async ([$tasks], set) => {
    if ($tasks.length === 0) {
      set([])
      return
    }
    
    try {
      const tasksWithUrgencyScores = await Promise.all(
        $tasks.map(async (task) => {
          const urgencyScore = await urgencyCalculator.calculateUrgency(task)
          const urgencyLevel = await urgencyCalculator.getUrgencyLevel(urgencyScore)
          return {
            ...task,
            urgencyScore,
            urgencyLevel
          }
        })
      )
      
      // 緊急性スコア順にソート（降順）
      tasksWithUrgencyScores.sort((a, b) => b.urgencyScore - a.urgencyScore)
      set(tasksWithUrgencyScores)
    } catch (err) {
      console.error('緊急性計算エラー:', err)
      set($tasks.map(task => ({ ...task, urgencyScore: 0, urgencyLevel: 'low' })))
    }
  },
  []
)

// タスクタイプ別の派生ストア
export const tasksByType = derived(
  [tasksWithUrgency, selectedTaskType],
  ([$tasksWithUrgency, $selectedTaskType]) => {
    if ($selectedTaskType === 'all') {
      return {
        work: $tasksWithUrgency.filter(task => task.type === 'work' && !task.parent_id),
        home: $tasksWithUrgency.filter(task => task.type === 'home' && !task.parent_id),
        skill: $tasksWithUrgency.filter(task => task.type === 'skill' && !task.parent_id)
      }
    }
    
    const filteredTasks = $tasksWithUrgency.filter(task => 
      task.type === $selectedTaskType && !task.parent_id
    )
    
    return {
      work: $selectedTaskType === 'work' ? filteredTasks : [],
      home: $selectedTaskType === 'home' ? filteredTasks : [],
      skill: $selectedTaskType === 'skill' ? filteredTasks : []
    }
  }
)

// データベース初期化と初期データ読み込み
let isInitialized = false

export const initializeApp = async () => {
  if (isInitialized) return
  
  try {
    loading.set(true)
    await initializeDatabase()
    
    // 初期データ読み込み
    await Promise.all([
      loadTasks(),
      loadSettings(),
      loadHistory()
    ])
    
    isInitialized = true
  } catch (err) {
    console.error('アプリ初期化エラー:', err)
    error.set('アプリの初期化に失敗しました: ' + err.message)
  } finally {
    loading.set(false)
  }
}

// タスク操作関数
export const taskActions = {
  // タスク読み込み
  async loadTasks() {
    try {
      loading.set(true)
      const activeTasks = await taskService.getActiveTasks()
      tasks.set(activeTasks)
    } catch (err) {
      error.set('タスクの読み込みに失敗しました: ' + err.message)
    } finally {
      loading.set(false)
    }
  },

  // タスク作成
  async createTask(taskData) {
    try {
      loading.set(true)
      await taskService.createTask(taskData)
      await this.loadTasks()
      
      // フォームリセット
      taskForm.set({
        type: 'work',
        name: '',
        due_date: '',
        importance: 5,
        effort_hours: 1,
        parent_id: null
      })
    } catch (err) {
      error.set('タスクの作成に失敗しました: ' + err.message)
    } finally {
      loading.set(false)
    }
  },

  // 編集モードでタスクを開始
  startEditTask(task) {
    const { id, ...taskData } = task
    taskForm.set(taskData)
    editMode.set({
      isEditing: true,
      editingTaskId: id,
      taskType: task.parent_id ? 'subtask' : 'task'
    })
  },

  // 編集をキャンセル
  cancelEdit() {
    editMode.set({
      isEditing: false,
      editingTaskId: null,
      taskType: 'task',
      isAddingSubtask: false,
      parentTaskId: null
    })
    taskForm.set({
      type: 'work',
      name: '',
      due_date: '',
      importance: 5,
      effort_hours: 1,
      parent_id: null
    })
  },

  // 編集を保存
  async saveEdit() {
    const editModeValue = get(editMode)
    const formData = get(taskForm)
    
    if (!editModeValue.isEditing) return
    
    try {
      loading.set(true)
      await this.updateTask(editModeValue.editingTaskId, formData)
      this.cancelEdit()
    } catch (err) {
      error.set('タスクの更新に失敗しました: ' + err.message)
    } finally {
      loading.set(false)
    }
  },

  // サブタスク追加モード開始
  startAddSubtask(parentTask) {
    taskForm.set({
      type: parentTask.type,
      name: '',
      due_date: parentTask.due_date,
      importance: parentTask.importance,
      effort_hours: 1,
      parent_id: parentTask.id
    })
    editMode.set({
      isEditing: false,
      editingTaskId: null,
      taskType: 'subtask',
      isAddingSubtask: true,
      parentTaskId: parentTask.id
    })
  },

  // タスク完了
  async completeTask(taskId) {
    try {
      loading.set(true)
      await taskService.completeTask(taskId)
      await Promise.all([
        this.loadTasks(),
        historyActions.loadHistory()
      ])
    } catch (err) {
      error.set('タスクの完了に失敗しました: ' + err.message)
    } finally {
      loading.set(false)
    }
  },

  // タスク削除
  async deleteTask(taskId) {
    try {
      loading.set(true)
      await taskService.deleteTask(taskId)
      await this.loadTasks()
    } catch (err) {
      error.set('タスクの削除に失敗しました: ' + err.message)
    } finally {
      loading.set(false)
    }
  },

  // タスク更新
  async updateTask(taskId, updates) {
    try {
      loading.set(true)
      await taskService.updateTask(taskId, updates)
      await this.loadTasks()
    } catch (err) {
      error.set('タスクの更新に失敗しました: ' + err.message)
    } finally {
      loading.set(false)
    }
  },

  // タスクを未完了に戻す
  async uncompleteTask(taskId) {
    try {
      loading.set(true)
      await taskService.uncompleteTask(taskId)
      await Promise.all([
        this.loadTasks(),
        historyActions.loadHistory()
      ])
    } catch (err) {
      error.set('タスクの未完了への変更に失敗しました: ' + err.message)
    } finally {
      loading.set(false)
    }
  },

  // サブタスク作成
  async createSubtask(parentId, taskData) {
    const subtaskData = {
      ...taskData,
      parent_id: parentId
    }
    await this.createTask(subtaskData)
  }
}

// 履歴操作関数
export const historyActions = {
  // 履歴読み込み（階層構造）
  async loadHistory(startDate = null, endDate = null) {
    try {
      loading.set(true)
      const historyData = await historyService.getHierarchicalHistory(startDate, endDate)
      history.set(historyData)
    } catch (err) {
      error.set('履歴の読み込みに失敗しました: ' + err.message)
    } finally {
      loading.set(false)
    }
  },

  // 工数統計取得
  async getEffortStats(startDate = null, endDate = null) {
    try {
      return await historyService.getEffortStats(startDate, endDate)
    } catch (err) {
      error.set('統計の取得に失敗しました: ' + err.message)
      return null
    }
  }
}

// 設定操作関数
export const settingsActions = {
  // 設定読み込み
  async loadSettings() {
    try {
      const [urgencyFormula, urgencyThresholds] = await Promise.all([
        settingsService.getSetting('urgency_formula'),
        settingsService.getSetting('urgency_thresholds')
      ])
      
      settings.set({
        urgency_formula: urgencyFormula,
        urgency_thresholds: urgencyThresholds
      })
      
      // 設定フォームも更新
      settingsForm.set({
        urgency_formula: urgencyFormula?.formula || '',
        urgency_thresholds: urgencyThresholds || { high: 10, medium: 3 }
      })
    } catch (err) {
      error.set('設定の読み込みに失敗しました: ' + err.message)
    }
  },

  // 緊急性計算式更新
  async updateUrgencyFormula(formula, description = '') {
    try {
      loading.set(true)
      await settingsService.updateSetting('urgency_formula', {
        formula,
        description,
        variables: ['effort', 'importance', 'daysLeft']
      })
      await this.loadSettings()
      await taskActions.loadTasks() // タスクの緊急性を再計算
    } catch (err) {
      error.set('緊急性計算式の更新に失敗しました: ' + err.message)
    } finally {
      loading.set(false)
    }
  },

  // 緊急性閾値更新
  async updateUrgencyThresholds(thresholds) {
    try {
      loading.set(true)
      await settingsService.updateSetting('urgency_thresholds', thresholds)
      await this.loadSettings()
      await taskActions.loadTasks() // タスクの緊急性レベルを再計算
    } catch (err) {
      error.set('緊急性閾値の更新に失敗しました: ' + err.message)
    } finally {
      loading.set(false)
    }
  }
}

// UI操作関数
export const uiActions = {
  // ビュー切り替え
  setView(view) {
    currentView.set(view)
  },

  // タスクタイプフィルター
  setTaskTypeFilter(type) {
    selectedTaskType.set(type)
  },

  // エラークリア
  clearError() {
    error.set(null)
  },

  // フォーム更新
  updateTaskForm(updates) {
    taskForm.update(form => ({ ...form, ...updates }))
  },

  updateSettingsForm(updates) {
    settingsForm.update(form => ({ ...form, ...updates }))
  }
}

// 便利な関数をエクスポート（レガシー互換）
export const loadTasks = taskActions.loadTasks
export const loadSettings = settingsActions.loadSettings
export const loadHistory = historyActions.loadHistory

// 統計用の派生ストア（階層構造対応）
export const historyStats = derived(
  [history],
  ([$history]) => {
    if ($history.length === 0) {
      return {
        totalTasks: 0,
        totalEffort: 0,
        averageEffort: 0,
        byType: { work: 0, home: 0, skill: 0 },
        recent7Days: 0
      }
    }

    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    
    const stats = {
      totalTasks: 0,
      totalEffort: 0,
      byType: { work: 0, home: 0, skill: 0 },
      recent7Days: 0
    }

    $history.forEach(parentRecord => {
      // 親タスクをカウント
      stats.totalTasks += 1
      stats.totalEffort += parentRecord.effort_hours
      stats.byType[parentRecord.task_type] += parentRecord.effort_hours
      
      if (new Date(parentRecord.completed_at) >= sevenDaysAgo) {
        stats.recent7Days += parentRecord.effort_hours
      }

      // サブタスクがある場合はそれらもカウント
      if (parentRecord.subtasks) {
        parentRecord.subtasks.forEach(subtask => {
          stats.totalTasks += 1
          stats.totalEffort += subtask.effort_hours
          stats.byType[subtask.task_type] += subtask.effort_hours
          
          if (new Date(subtask.completed_at) >= sevenDaysAgo) {
            stats.recent7Days += subtask.effort_hours
          }
        })
      }
    })

    stats.averageEffort = stats.totalTasks > 0 ? stats.totalEffort / stats.totalTasks : 0

    return stats
  }
)