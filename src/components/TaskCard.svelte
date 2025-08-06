<script>
  import { taskActions } from '../stores.js'
  import LoadingSpinner from './LoadingSpinner.svelte'
  import { createEventDispatcher } from 'svelte'

  export let task

  const dispatch = createEventDispatcher()
  let isCompleting = false
  let showSubtasks = false

  // 緊急性レベルに応じたスタイル
  $: urgencyStyle = {
    high: 'border-l-red-500 bg-red-50 shadow-red-100',
    medium: 'border-l-amber-500 bg-amber-50 shadow-amber-100',
    low: 'border-l-blue-500 bg-blue-50 shadow-blue-100'
  }[task.urgencyLevel] || 'border-l-gray-500 bg-gray-50'

  // 締切日の表示とスタイル
  $: dueInfo = (() => {
    const dueDate = new Date(task.due_date)
    const today = new Date()
    const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24))
    
    let label, style
    if (diffDays < 0) {
      label = `${Math.abs(diffDays)}日遅れ`
      style = 'text-red-600 bg-red-100'
    } else if (diffDays === 0) {
      label = '今日まで'
      style = 'text-red-600 bg-red-100'
    } else if (diffDays === 1) {
      label = '明日まで'
      style = 'text-amber-600 bg-amber-100'
    } else if (diffDays <= 3) {
      label = `${diffDays}日後`
      style = 'text-amber-600 bg-amber-100'
    } else {
      label = `${diffDays}日後`
      style = 'text-gray-600 bg-gray-100'
    }
    
    return { label, style, diffDays }
  })()

  // タスク完了処理
  async function handleComplete() {
    if (isCompleting) return
    
    if (confirm(`「${task.name}」を完了しますか？`)) {
      isCompleting = true
      try {
        await taskActions.completeTask(task.id)
        dispatch('completed', task)
      } catch (error) {
        console.error('タスク完了エラー:', error)
      } finally {
        isCompleting = false
      }
    }
  }

  // サブタスク表示切り替え
  function toggleSubtasks() {
    showSubtasks = !showSubtasks
  }

  // サブタスク追加
  function handleAddSubtask() {
    const subtaskName = prompt('サブタスク名を入力してください:')
    if (subtaskName && subtaskName.trim()) {
      const subtaskData = {
        type: task.type,
        name: subtaskName.trim(),
        due_date: task.due_date,
        importance: task.importance,
        effort_hours: 0.5, // デフォルト0.5時間
        parent_id: task.id
      }
      taskActions.createTask(subtaskData)
    }
  }

  // サブタスク完了処理
  async function handleSubtaskComplete(subtaskId) {
    if (confirm('このサブタスクを完了しますか？')) {
      try {
        await taskActions.completeTask(subtaskId)
        dispatch('completed', { id: subtaskId, isSubtask: true })
      } catch (error) {
        console.error('サブタスク完了エラー:', error)
      }
    }
  }

  // 緊急性スコアの表示形式
  $: displayUrgencyScore = task.urgencyScore === Number.MAX_SAFE_INTEGER 
    ? '∞' 
    : task.urgencyScore.toFixed(1)

  // 工数の表示（サブタスク込み）
  $: displayEffort = task.total_effort_hours !== task.effort_hours 
    ? `${task.total_effort_hours.toFixed(1)}h (${task.effort_hours.toFixed(1)}h + サブ)`
    : `${task.effort_hours.toFixed(1)}h`

  // 重要度の色分け（5:暖色 → 1:寒色）
  function getImportanceColor(importance) {
    const colors = {
      5: 'bg-red-100 text-red-800',      // 最高：赤（暖色）
      4: 'bg-orange-100 text-orange-800', // 高：オレンジ
      3: 'bg-yellow-100 text-yellow-800', // 中：黄
      2: 'bg-green-100 text-green-800',   // 低：緑
      1: 'bg-blue-100 text-blue-800'     // 最低：青（寒色）
    }
    return colors[importance] || 'bg-gray-100 text-gray-700'
  }
</script>

<div class="task-card {urgencyStyle} hover:shadow-lg transition-all duration-200 cursor-pointer group relative">
  <!-- メインタスク情報 -->
  <div class="flex items-start justify-between">
    <div class="flex-1 min-w-0">
      <!-- タスク名 -->
      <h4 class="font-medium text-gray-900 truncate group-hover:text-gray-700">
        {task.name}
      </h4>
      
      <!-- メタ情報 -->
      <div class="mt-2 flex flex-wrap gap-2 text-xs">
        <!-- 締切日 -->
        <span class="px-2 py-1 rounded-full {dueInfo.style} font-medium">
          📅 {dueInfo.label}
        </span>
        
        <!-- 重要度 -->
        <span class="px-2 py-1 rounded-full {getImportanceColor(task.importance)}">
          ⭐ {task.importance}/5
        </span>
        
        <!-- 工数 -->
        <span class="px-2 py-1 rounded-full bg-gray-100 text-gray-700" title="工数">
          ⏱️ {displayEffort}
        </span>
        
        <!-- 緊急性スコア -->
        <span 
          class="px-2 py-1 rounded-full font-bold
                 {task.urgencyLevel === 'high' ? 'bg-red-200 text-red-800' :
                   task.urgencyLevel === 'medium' ? 'bg-amber-200 text-amber-800' :
                   'bg-blue-200 text-blue-800'}"
          title="緊急性スコア"
        >
          🚨 {displayUrgencyScore}
        </span>
      </div>

      <!-- サブタスク情報 -->
      {#if task.subtasks && task.subtasks.length > 0}
        <div class="mt-3 relative z-20">
          <button
            type="button"
            class="text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 px-4 py-2 rounded-lg border border-gray-200 flex items-center transition-all duration-200 font-medium shadow-sm hover:shadow-md"
            on:click|stopPropagation={toggleSubtasks}
          >
            <span class="mr-2 text-lg">
              {showSubtasks ? '📂' : '📁'}
            </span>
            サブタスク {task.subtasks.length}件
            <span class="ml-2 text-xs text-gray-500">
              {showSubtasks ? '▲' : '▼'}
            </span>
          </button>
        </div>
      {/if}
    </div>

    <!-- サブタスク追加ボタン（親タスクのみ） -->
    {#if !task.parent_id}
      <div class="absolute top-3 left-3 z-30">
        <button
          type="button"
          class="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md opacity-0 group-hover:opacity-100"
          on:click|stopPropagation={handleAddSubtask}
          title="サブタスク追加"
        >
          ➕ サブタスク
        </button>
      </div>
    {/if}
  </div>

  <!-- サブタスク一覧 -->
  {#if showSubtasks && task.subtasks && task.subtasks.length > 0}
    <div class="mt-4 space-y-3 relative z-20">
      {#each task.subtasks as subtask}
        <div class="bg-white bg-opacity-80 border border-gray-200 rounded-lg p-3 hover:shadow-sm transition-shadow duration-200">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="font-medium text-gray-700 mb-1">{subtask.name}</div>
              <div class="flex flex-wrap gap-2 text-xs">
                <span class="px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                  ⏱️ {subtask.effort_hours.toFixed(1)}h
                </span>
                <span class="px-2 py-1 rounded-full {getImportanceColor(subtask.importance)}">
                  ⭐ {subtask.importance}/5
                </span>
              </div>
            </div>
            <button
              type="button"
              class="ml-3 px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 text-sm rounded-full transition-all duration-200 font-semibold shadow-sm hover:shadow-md hover:scale-105"
              on:click|stopPropagation={() => handleSubtaskComplete(subtask.id)}
              title="サブタスクを完了"
            >
              <span class="flex items-center">
                <span class="text-base mr-1">✓</span>
                完了
              </span>
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- 完了ボタン（大きい丸い長方形） -->
  <div class="absolute top-3 right-3 z-30">
    <button
      type="button"
      class="px-6 py-3 bg-green-100 hover:bg-green-200 text-green-700 rounded-full text-base font-semibold transition-all duration-200 shadow-md hover:shadow-lg opacity-0 group-hover:opacity-100 hover:scale-105"
      on:click|stopPropagation={handleComplete}
      disabled={isCompleting}
      title="タスクを完了"
    >
      {#if isCompleting}
        <span class="flex items-center">
          <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          処理中
        </span>
      {:else}
        <span class="flex items-center">
          <span class="text-lg mr-1">✓</span>
          完了
        </span>
      {/if}
    </button>
  </div>
</div>

<style>
  .task-card {
    position: relative;
  }
  
  .task-card:hover {
    transform: translateY(-1px);
  }
</style>