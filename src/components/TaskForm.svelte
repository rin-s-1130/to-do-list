<script>
  import { taskForm, taskActions, loading, tasks, editMode } from '../stores.js'
  import LoadingSpinner from './LoadingSpinner.svelte'

  // フォームの初期値設定
  const taskTypes = [
    { value: 'work', label: '仕事', icon: '💼' },
    { value: 'home', label: '家', icon: '🏠' },
    { value: 'skill', label: 'スキルアップ', icon: '📚' }
  ]

  const importanceOptions = [
    { value: 5, label: '5 - 高', color: 'text-red-700' },
    { value: 4, label: '4', color: 'text-orange-700' },
    { value: 3, label: '3 - 中', color: 'text-yellow-700' },
    { value: 2, label: '2', color: 'text-green-700' },
    { value: 1, label: '1 - 低', color: 'text-blue-700' }
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
    
    // 期限なしの場合はバリデーションをスキップ
    if ($taskForm.due_date !== null && !$taskForm.due_date) {
      alert('締切日を選択するか、期限なしを選択してください')
      return
    }

    // 編集モード、サブタスク追加モード、通常作成モードで処理を分ける
    if ($editMode.isEditing) {
      await taskActions.saveEdit()
    } else {
      await taskActions.createTask($taskForm)
      // サブタスク追加モードの場合はフォーム状態をリセット
      if ($editMode.isAddingSubtask) {
        taskActions.cancelEdit()
      }
    }
  }

  // 編集をキャンセル
  function handleCancel() {
    taskActions.cancelEdit()
  }

  // フォーム入力の処理
  function handleInputChange(field, value) {
    taskForm.update(form => ({ ...form, [field]: value }))
  }
  
  // parent_idの型を正しく管理
  $: if ($taskForm.parent_id === '') {
    taskForm.update(form => ({ ...form, parent_id: null }))
  }
  
  // 親タスク選択時にタスクタイプ、締切日、重要度を自動的に合わせる
  $: if ($taskForm.parent_id) {
    const selectedParent = $tasks.find(task => task.id === $taskForm.parent_id)
    if (selectedParent) {
      const updates = {}
      if (selectedParent.type !== $taskForm.type) {
        updates.type = selectedParent.type
      }
      if (selectedParent.due_date !== $taskForm.due_date) {
        updates.due_date = selectedParent.due_date
      }
      if (selectedParent.importance !== $taskForm.importance) {
        updates.importance = selectedParent.importance
      }
      if (Object.keys(updates).length > 0) {
        taskForm.update(form => ({ ...form, ...updates }))
      }
    }
  }

  // 締切日の最小値（今日）
  const minDate = today.toISOString().split('T')[0]
  
  // デフォルト値の設定
  if (!$taskForm.due_date) {
    taskForm.update(form => ({ ...form, due_date: defaultDueDate }))
  }

  // 親タスクの選択肢（すべての親タスク）
  $: parentTaskOptions = $tasks.filter(task => task.parent_id === null)

  // タスクタイプのアイコン取得
  function getTaskTypeIcon(type) {
    const typeConfig = taskTypes.find(t => t.value === type)
    return typeConfig ? typeConfig.icon : '📋'
  }
</script>

<form on:submit={handleSubmit} class="space-y-4">
  <!-- 親タスク選択（最上部） -->
  <div class="mb-4">
    <label for="parent-task" class="block text-sm font-medium text-gray-700 mb-1">
      リレーション
    </label>
    <select
      id="parent-task"
      class="form-input max-w-md"
      value={$taskForm.parent_id || ''}
      on:change={(e) => handleInputChange('parent_id', e.target.value ? parseInt(e.target.value) : null)}
    >
      <option value="">独立したタスク</option>
      {#each parentTaskOptions as task}
        <option value={task.id}>
          {getTaskTypeIcon(task.type)} {task.name}
        </option>
      {/each}
    </select>
    <p class="mt-1 text-sm text-gray-500">
      既存のタスクのサブタスクとして作成する場合は選択してください（種類は親タスクに自動で合わせられます）
    </p>
  </div>

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
        disabled={$taskForm.parent_id !== null}
      >
        {#each taskTypes as type}
          <option value={type.value}>
            {type.icon} {type.label}
          </option>
        {/each}
      </select>
      {#if $taskForm.parent_id !== null}
        <p class="mt-1 text-xs text-gray-500">親タスクの種類に自動設定されます</p>
      {/if}
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
      <div class="space-y-2">
        <!-- 期限なしのチェックボックス -->
        <label class="flex items-center">
          <input
            type="checkbox"
            class="mr-2"
            checked={$taskForm.due_date === null}
            on:change={(e) => handleInputChange('due_date', e.target.checked ? null : defaultDueDate)}
            disabled={$taskForm.parent_id !== null}
          />
          <span class="text-sm text-gray-600">📅 期限なし（無限）</span>
        </label>
        
        <!-- 日付入力（期限ありの場合のみ表示） -->
        {#if $taskForm.due_date !== null}
          <input
            id="due-date"
            type="date"
            class="form-input"
            value={$taskForm.due_date || ''}
            min={minDate}
            on:change={(e) => handleInputChange('due_date', e.target.value)}
            disabled={$taskForm.parent_id !== null}
            required
          />
        {/if}
      </div>
      {#if $taskForm.parent_id !== null}
        <p class="mt-1 text-xs text-gray-500">親タスクの締切日に自動設定されます</p>
      {/if}
    </div>

    <!-- 重要度 -->
    <div class="lg:col-span-1">
      <label for="importance" class="block text-sm font-medium text-gray-700 mb-1">
        重要度
      </label>
      <div class="relative">
        <select
          id="importance"
          class="form-input"
          value={$taskForm.importance}
          on:change={(e) => handleInputChange('importance', parseInt(e.target.value))}
          disabled={$taskForm.parent_id !== null}
          required
        >
          {#each importanceOptions as option}
            <option value={option.value} class="{option.color}">
              {option.label}
            </option>
          {/each}
        </select>
      </div>
      {#if $taskForm.parent_id !== null}
        <p class="mt-1 text-xs text-gray-500">親タスクの重要度に自動設定されます</p>
      {/if}
    </div>

    <!-- 工数 -->
    <div class="lg:col-span-1">
      <label for="effort-hours" class="block text-sm font-medium text-gray-700 mb-1">
        工数 (h)
      </label>
      <input
        id="effort-hours"
        type="number"
        class="form-input"
        min="0"
        max="1000"
        step="0.1"
        value={$taskForm.effort_hours}
        on:input={(e) => handleInputChange('effort_hours', parseFloat(e.target.value) || 0)}
        required
      />
      <p class="mt-1 text-xs text-gray-500">親タスクは工数0、サブタスクで実際の工数を管理</p>
    </div>
  </div>

  <!-- 送信ボタン -->
  <div class="flex justify-end gap-2">
    {#if $editMode.isEditing}
      <button
        type="button"
        class="btn-secondary"
        on:click={handleCancel}
        disabled={$loading}
      >
        キャンセル
      </button>
      <button
        type="submit"
        class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        disabled={$loading}
      >
        {#if $loading}
          <LoadingSpinner size="sm" color="white" />
          <span class="ml-2">更新中...</span>
        {:else}
          <span>💾 タスク更新</span>
        {/if}
      </button>
    {:else if $editMode.isAddingSubtask}
      <button
        type="button"
        class="btn-secondary"
        on:click={handleCancel}
        disabled={$loading}
      >
        キャンセル
      </button>
      <button
        type="submit"
        class="btn-primary disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        disabled={$loading}
      >
        {#if $loading}
          <LoadingSpinner size="sm" color="white" />
          <span class="ml-2">作成中...</span>
        {:else}
          <span>➕ サブタスク追加</span>
        {/if}
      </button>
    {:else}
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
    {/if}
  </div>
</form>

<!-- キーボード操作のヒント -->
<div class="mt-4 text-xs text-gray-500">
  💡 Tabキーで各フィールド間を素早く移動できます
</div>