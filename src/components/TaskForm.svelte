<script>
  import { taskForm, taskActions, loading, tasks } from '../stores.js'
  import LoadingSpinner from './LoadingSpinner.svelte'

  // フォームの初期値設定
  const taskTypes = [
    { value: 'work', label: '仕事', icon: '💼' },
    { value: 'home', label: '家', icon: '🏠' },
    { value: 'skill', label: 'スキルアップ', icon: '📚' }
  ]

  const importanceOptions = [
    { value: 1, label: '1 - 低' },
    { value: 2, label: '2' },
    { value: 3, label: '3 - 中' },
    { value: 4, label: '4' },
    { value: 5, label: '5 - 高' }
  ]

  // 今日の日付を取得（デフォルトの締切日として使用）
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  const defaultDueDate = tomorrow.toISOString().split('T')[0]

  // フォーム送信処理
  async function handleSubmit(event) {
    event.preventDefault()
    
    // バリデーション
    if (!$taskForm.name.trim()) {
      alert('タスク名を入力してください')
      return
    }
    
    if (!$taskForm.due_date) {
      alert('締切日を選択してください')
      return
    }

    // タスク作成
    await taskActions.createTask($taskForm)
  }

  // フォーム入力の処理
  function handleInputChange(field, value) {
    taskForm.update(form => ({ ...form, [field]: value }))
  }

  // 締切日の最小値（今日）
  const minDate = today.toISOString().split('T')[0]
  
  // デフォルト値の設定
  if (!$taskForm.due_date) {
    taskForm.update(form => ({ ...form, due_date: defaultDueDate }))
  }

  // 親タスクの選択肢（親タスクのみ）
  $: parentTaskOptions = $tasks.filter(task => task.parent_id === null)

  // タスクタイプのアイコン取得
  function getTaskTypeIcon(type) {
    const typeConfig = taskTypes.find(t => t.value === type)
    return typeConfig ? typeConfig.icon : '📋'
  }
</script>

<form on:submit={handleSubmit} class="space-y-4">
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
    
    <!-- タスクの種類 -->
    <div class="lg:col-span-1">
      <label for="task-type" class="block text-sm font-medium text-gray-700 mb-1">
        種類
      </label>
      <select
        id="task-type"
        class="form-input"
        value={$taskForm.type}
        on:change={(e) => handleInputChange('type', e.target.value)}
        required
      >
        {#each taskTypes as type}
          <option value={type.value}>
            {type.icon} {type.label}
          </option>
        {/each}
      </select>
    </div>

    <!-- タスク名 -->
    <div class="lg:col-span-2">
      <label for="task-name" class="block text-sm font-medium text-gray-700 mb-1">
        タスク名 <span class="text-red-500">*</span>
      </label>
      <input
        id="task-name"
        type="text"
        class="form-input"
        placeholder="やるべきことを入力..."
        value={$taskForm.name}
        on:input={(e) => handleInputChange('name', e.target.value)}
        required
        maxlength="100"
      />
    </div>

    <!-- 締切日 -->
    <div class="lg:col-span-1">
      <label for="due-date" class="block text-sm font-medium text-gray-700 mb-1">
        締切日 <span class="text-red-500">*</span>
      </label>
      <input
        id="due-date"
        type="date"
        class="form-input"
        value={$taskForm.due_date}
        min={minDate}
        on:change={(e) => handleInputChange('due_date', e.target.value)}
        required
      />
    </div>

    <!-- 重要度 -->
    <div class="lg:col-span-1">
      <label for="importance" class="block text-sm font-medium text-gray-700 mb-1">
        重要度
      </label>
      <select
        id="importance"
        class="form-input"
        value={$taskForm.importance}
        on:change={(e) => handleInputChange('importance', parseInt(e.target.value))}
        required
      >
        {#each importanceOptions as option}
          <option value={option.value}>
            {option.label}
          </option>
        {/each}
      </select>
    </div>

    <!-- 工数 -->
    <div class="lg:col-span-1">
      <label for="effort-hours" class="block text-sm font-medium text-gray-700 mb-1">
        工数 (時間)
      </label>
      <input
        id="effort-hours"
        type="number"
        class="form-input"
        min="0.1"
        max="1000"
        step="0.1"
        value={$taskForm.effort_hours}
        on:input={(e) => handleInputChange('effort_hours', parseFloat(e.target.value) || 0.1)}
        required
      />
    </div>
  </div>

  <!-- 親タスク選択（サブタスク作成時） -->
  {#if parentTaskOptions.length > 0}
    <div class="mt-4">
      <label for="parent-task" class="block text-sm font-medium text-gray-700 mb-1">
        親タスク（オプション）
      </label>
      <select
        id="parent-task"
        class="form-input max-w-md"
        value={$taskForm.parent_id || ''}
        on:change={(e) => handleInputChange('parent_id', e.target.value || null)}
      >
        <option value="">独立したタスク</option>
        {#each parentTaskOptions as task}
          <option value={task.id}>
            {getTaskTypeIcon(task.type)} {task.name}
          </option>
        {/each}
      </select>
      <p class="mt-1 text-sm text-gray-500">
        既存のタスクのサブタスクとして作成する場合は選択してください
      </p>
    </div>
  {/if}

  <!-- 送信ボタン -->
  <div class="flex justify-end">
    <button
      type="submit"
      class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
      disabled={$loading}
    >
      {#if $loading}
        <LoadingSpinner size="sm" color="white" />
        <span class="ml-2">作成中...</span>
      {:else}
        <span>📝 タスク追加</span>
      {/if}
    </button>
  </div>
</form>

<!-- キーボード操作のヒント -->
<div class="mt-4 text-xs text-gray-500">
  💡 Tabキーで各フィールド間を素早く移動できます
</div>