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

  // 緊急性スコアの表示形式
  $: displayUrgencyScore = task.urgencyScore === Number.MAX_SAFE_INTEGER 
    ? '∞' 
    : task.urgencyScore.toFixed(1)

  // 工数の表示（サブタスク込み）
  $: displayEffort = task.total_effort_hours !== task.effort_hours 
    ? `${task.total_effort_hours.toFixed(1)}h (${task.effort_hours.toFixed(1)}h + サブ)`
    : `${task.effort_hours.toFixed(1)}h`
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
        <span class="px-2 py-1 rounded-full bg-gray-100 text-gray-700">
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
        <div class="mt-2">
          <button
            type="button"
            class="text-xs text-gray-500 hover:text-gray-700 flex items-center"
            on:click|stopPropagation={toggleSubtasks}
          >
            <span class="mr-1">
              {showSubtasks ? '📂' : '📁'}
            </span>
            サブタスク {task.subtasks.length}件
          </button>
        </div>
      {/if}
    </div>

    <!-- アクションボタン -->
    <div class="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
      <!-- サブタスク追加ボタン（親タスクのみ） -->
      {#if !task.parent_id}
        <button
          type="button"
          class="p-1 text-blue-600 hover:text-blue-700 hover:bg-blue-100 rounded"
          on:click|stopPropagation={handleAddSubtask}
          title="サブタスク追加"
          aria-label="サブタスクを追加"
        >
          ➕
        </button>
      {/if}
      
      <!-- 完了ボタン -->
      <button
        type="button"
        class="p-1 text-green-600 hover:text-green-700 hover:bg-green-100 rounded"
        on:click|stopPropagation={handleComplete}
        disabled={isCompleting}
        title="完了"
        aria-label="タスクを完了"
      >
        {#if isCompleting}
          <LoadingSpinner size="sm" color="green" />
        {:else}
          ✅
        {/if}
      </button>
    </div>
  </div>

  <!-- サブタスク一覧 -->
  {#if showSubtasks && task.subtasks && task.subtasks.length > 0}
    <div class="mt-3 pl-4 border-l-2 border-gray-200 space-y-2">
      {#each task.subtasks as subtask}
        <div class="text-sm bg-white bg-opacity-50 rounded p-2">
          <div class="font-medium text-gray-700">{subtask.name}</div>
          <div class="text-xs text-gray-500 mt-1">
            ⏱️ {subtask.effort_hours.toFixed(1)}h | ⭐ {subtask.importance}/5
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- クリック時の完了アクション -->
  <div 
    class="absolute inset-0 z-10" 
    on:click={handleComplete}
    on:keydown={(e) => e.key === 'Enter' && handleComplete()}
    role="button"
    tabindex="0"
    aria-label="クリックでタスクを完了"
  ></div>
</div>

<style>
  .task-card {
    position: relative;
  }
  
  .task-card:hover {
    transform: translateY(-1px);
  }
</style>