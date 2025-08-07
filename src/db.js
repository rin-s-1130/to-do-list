import Dexie from 'dexie'

// IndexedDB + Dexie.js データベース設計
class TodoDatabase extends Dexie {
  constructor() {
    super('TodoAppDB')
    
    this.version(1).stores({
      // タスクテーブル
      tasks: '++id, type, name, due_date, importance, effort_hours, parent_id, status, created_at, updated_at',
      // 履歴テーブル
      history: '++id, task_id, completed_at, effort_hours, task_name, task_type, parent_id',
      // 設定テーブル（緊急性計算式など）
      settings: '++id, key, value, updated_at'
    })
    
    // インデックス設定
    this.tasks.hook('creating', function (primKey, obj, trans) {
      obj.created_at = new Date().toISOString()
      obj.updated_at = new Date().toISOString()
    })
    
    this.tasks.hook('updating', function (modifications, primKey, obj, trans) {
      modifications.updated_at = new Date().toISOString()
    })
  }
}

const db = new TodoDatabase()

// デフォルト設定の初期化
const initializeDefaultSettings = async () => {
  const existingSettings = await db.settings.count()
  if (existingSettings === 0) {
    await db.settings.bulkAdd([
      {
        key: 'urgency_formula',
        value: JSON.stringify({
          formula: '(effort * importance) / Math.max(0.1, Math.pow(daysLeft, 1.5))',
          description: 'デフォルト: (工数 × 重要度) ÷ (残り日数^1.5)',
          variables: ['effort', 'importance', 'daysLeft']
        }),
        updated_at: new Date().toISOString()
      },
      {
        key: 'urgency_thresholds',
        value: JSON.stringify({
          high: 10,    // 高緊急度の閾値
          medium: 3    // 中緊急度の閾値
        }),
        updated_at: new Date().toISOString()
      }
    ])
  }
}

// タスク関連のCRUD操作
export const taskService = {
  // タスク作成
  async createTask(taskData) {
    const task = {
      type: taskData.type, // 'work' | 'home' | 'skill'
      name: taskData.name,
      due_date: taskData.due_date, // ISO string
      importance: taskData.importance, // 1-5
      effort_hours: taskData.effort_hours, // float
      parent_id: taskData.parent_id || null,
      status: 'active' // 'active' | 'done'
    }
    return await db.tasks.add(task)
  },

  // アクティブなタスク取得（サブタスクの工数合計を含む）
  async getActiveTasks() {
    const tasks = await db.tasks.where('status').equals('active').toArray()
    
    // サブタスクの工数を親タスクに集約
    const tasksWithSubtaskEffort = await Promise.all(
      tasks.map(async (task) => {
        if (task.parent_id === null) {
          // 親タスクの場合、サブタスクの工数合計を取得
          const subtasks = await db.tasks
            .where('parent_id').equals(task.id)
            .and(subtask => subtask.status === 'active')
            .toArray()
          
          const subtaskEffortSum = subtasks.reduce((sum, subtask) => sum + subtask.effort_hours, 0)
          
          return {
            ...task,
            total_effort_hours: task.effort_hours + subtaskEffortSum,
            // 完了・未完了問わずすべてのサブタスクを取得
            subtasks: await db.tasks.where('parent_id').equals(task.id).toArray()
          }
        }
        return {
          ...task,
          total_effort_hours: task.effort_hours,
          subtasks: []
        }
      })
    )
    
    return tasksWithSubtaskEffort
  },

  // タスク完了
  async completeTask(taskId) {
    const task = await db.tasks.get(taskId)
    if (!task) throw new Error('Task not found')
    
    // 履歴に保存
    await db.history.add({
      task_id: taskId,
      completed_at: new Date().toISOString(),
      effort_hours: task.effort_hours,
      task_name: task.name,
      task_type: task.type,
      parent_id: task.parent_id
    })
    
    // タスクを完了状態に更新
    await db.tasks.update(taskId, { 
      status: 'done',
      completed_at: new Date().toISOString()
    })
    
    // サブタスクがある場合、すべて完了にする
    const subtasks = await db.tasks.where('parent_id').equals(taskId).toArray()
    for (const subtask of subtasks) {
      if (subtask.status === 'active') {
        await this.completeTask(subtask.id)
      }
    }
  },

  // タスク削除
  async deleteTask(taskId) {
    // サブタスクも一緒に削除
    const subtasks = await db.tasks.where('parent_id').equals(taskId).toArray()
    for (const subtask of subtasks) {
      await db.tasks.delete(subtask.id)
    }
    await db.tasks.delete(taskId)
  },

  // タスク更新
  async updateTask(taskId, updates) {
    return await db.tasks.update(taskId, updates)
  },

  // タスクを未完了に戻す
  async uncompleteTask(taskId) {
    const task = await db.tasks.get(taskId)
    if (!task) throw new Error('Task not found')
    
    // タスクを未完了状態に更新
    await db.tasks.update(taskId, { 
      status: 'active',
      completed_at: null
    })
    
    // 履歴から削除
    await db.history.where('task_id').equals(taskId).delete()

    // 親タスクの場合、関連するサブタスクは完了状態のまま復元する
    // （サブタスクの履歴は削除しない）
  }
}

// 設定関連の操作
export const settingsService = {
  // 設定取得
  async getSetting(key) {
    const setting = await db.settings.where('key').equals(key).first()
    return setting ? JSON.parse(setting.value) : null
  },

  // 設定更新
  async updateSetting(key, value) {
    const existing = await db.settings.where('key').equals(key).first()
    const settingData = {
      key,
      value: JSON.stringify(value),
      updated_at: new Date().toISOString()
    }
    
    if (existing) {
      await db.settings.update(existing.id, settingData)
    } else {
      await db.settings.add(settingData)
    }
  }
}

// 履歴関連の操作
export const historyService = {
  // 履歴取得（期間指定可能）
  async getHistory(startDate = null, endDate = null) {
    let query = db.history.orderBy('completed_at').reverse()
    
    if (startDate && endDate) {
      query = query.filter(record => 
        record.completed_at >= startDate && record.completed_at <= endDate
      )
    }
    
    return await query.toArray()
  },

  // 階層構造の履歴取得（親タスクとサブタスクをグループ化）
  async getHierarchicalHistory(startDate = null, endDate = null) {
    const allHistory = await this.getHistory(startDate, endDate)
    
    // 親タスクとサブタスクを分離
    const parentTasks = allHistory.filter(record => !record.parent_id)
    const subtasks = allHistory.filter(record => record.parent_id)
    
    // 親タスクにサブタスクを関連付け
    const hierarchicalHistory = parentTasks.map(parent => {
      const relatedSubtasks = subtasks.filter(sub => sub.parent_id === parent.task_id)
      return {
        ...parent,
        subtasks: relatedSubtasks.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
      }
    })
    
    // 親のない独立したタスクも含める（parent_idがnullのもの）
    return hierarchicalHistory.sort((a, b) => new Date(b.completed_at) - new Date(a.completed_at))
  },

  // 工数統計取得
  async getEffortStats(startDate = null, endDate = null) {
    const history = await this.getHistory(startDate, endDate)
    
    const stats = {
      total_effort: 0,
      by_type: { work: 0, home: 0, skill: 0 },
      by_date: {}
    }
    
    history.forEach(record => {
      stats.total_effort += record.effort_hours
      stats.by_type[record.task_type] += record.effort_hours
      
      const date = record.completed_at.split('T')[0]
      stats.by_date[date] = (stats.by_date[date] || 0) + record.effort_hours
    })
    
    return stats
  }
}

// 緊急性計算ロジック
export const urgencyCalculator = {
  // 緊急性スコア計算
  async calculateUrgency(task) {
    const formula = await settingsService.getSetting('urgency_formula')
    if (!formula) {
      // フォールバック用デフォルト計算
      return this.defaultUrgencyCalculation(task)
    }
    
    try {
      // 期限なしの場合は低い緊急度（重要度のみで計算）
      if (!task.due_date) {
        const effort = task.total_effort_hours || task.effort_hours
        const importance = task.importance
        return importance * effort * 0.1 // 期限なしは緊急度を低く設定
      }
      
      const dueDate = new Date(task.due_date)
      const now = new Date()
      const daysLeft = Math.max(0, (dueDate - now) / (1000 * 60 * 60 * 24))
      
      // 残り日数が0の場合は無限大
      if (daysLeft === 0) {
        return Number.MAX_SAFE_INTEGER
      }
      
      const effort = task.total_effort_hours || task.effort_hours
      const importance = task.importance
      
      // 動的に数式を評価（セキュリティ注意）
      const result = Function('effort', 'importance', 'daysLeft', `return ${formula.formula}`)(
        effort, importance, daysLeft
      )
      
      return isNaN(result) ? 0 : result
    } catch (error) {
      console.error('緊急性計算エラー:', error)
      return this.defaultUrgencyCalculation(task)
    }
  },

  // デフォルト緊急性計算
  defaultUrgencyCalculation(task) {
    // 期限なしの場合は低い緊急度
    if (!task.due_date) {
      const effort = task.total_effort_hours || task.effort_hours
      const importance = task.importance
      return importance * effort * 0.1
    }
    
    const dueDate = new Date(task.due_date)
    const now = new Date()
    const daysLeft = Math.max(0, (dueDate - now) / (1000 * 60 * 60 * 24))
    
    if (daysLeft === 0) return Number.MAX_SAFE_INTEGER
    
    const effort = task.total_effort_hours || task.effort_hours
    const importance = task.importance
    
    return (effort * importance) / Math.max(0.1, Math.pow(daysLeft, 1.5))
  },

  // 緊急性レベル判定
  async getUrgencyLevel(urgencyScore) {
    const thresholds = await settingsService.getSetting('urgency_thresholds')
    if (!thresholds) {
      // デフォルト閾値
      if (urgencyScore >= 10) return 'high'
      if (urgencyScore >= 3) return 'medium'
      return 'low'
    }
    
    if (urgencyScore >= thresholds.high) return 'high'
    if (urgencyScore >= thresholds.medium) return 'medium'
    return 'low'
  }
}

// データベース初期化
export const initializeDatabase = async () => {
  await db.open()
  await initializeDefaultSettings()
  return db
}

export default db