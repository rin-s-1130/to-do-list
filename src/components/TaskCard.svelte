<script>
  import { taskActions, editMode } from '../stores.js'
  import LoadingSpinner from './LoadingSpinner.svelte'
  import { createEventDispatcher } from 'svelte'

  export let task

  const dispatch = createEventDispatcher()
  let isCompleting = false
  let showSubtasks = false
  let isCompletingWithAnimation = false

  // 緊急性レベルに応じたスタイル
  $: urgencyStyle = {
    high: 'border-l-red-500 bg-red-50 shadow-red-100',
    medium: 'border-l-amber-500 bg-amber-50 shadow-amber-100',
    low: 'border-l-blue-500 bg-blue-50 shadow-blue-100'
  }[task.urgencyLevel] || 'border-l-gray-500 bg-gray-50'

  // 締切日の表示とスタイル
  $: dueInfo = (() => {
    // 期限なしの場合
    if (!task.due_date) {
      return { 
        label: '期限なし', 
        style: 'text-blue-600 bg-blue-100', 
        diffDays: Infinity 
      }
    }
    
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
    if (isCompleting || isCompletingWithAnimation) return
    
    isCompleting = true
    isCompletingWithAnimation = true
    
    try {
      // 1.5秒後にタスクを完了
      setTimeout(async () => {
        try {
          await taskActions.completeTask(task.id)
          dispatch('completed', task)
        } catch (error) {
          console.error('タスク完了エラー:', error)
          isCompletingWithAnimation = false
        } finally {
          isCompleting = false
        }
      }, 1500)
      
    } catch (error) {
      console.error('タスク完了エラー:', error)
      isCompleting = false
      isCompletingWithAnimation = false
    }
  }

  // サブタスク表示切り替え
  function toggleSubtasks() {
    showSubtasks = !showSubtasks
  }

  // サブタスク追加
  function handleAddSubtask() {
    taskActions.startAddSubtask(task)
    // フォームエリアまでスクロール
    document.querySelector('form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // サブタスク完了処理（アニメーション付き）
  let completingSubtasks = new Set()
  
  async function handleSubtaskComplete(subtaskId) {
    if (completingSubtasks.has(subtaskId)) return
    
    try {
      // アニメーション開始
      completingSubtasks.add(subtaskId)
      completingSubtasks = new Set(completingSubtasks)
      
      // 1.5秒後に実際に完了処理
      setTimeout(async () => {
        try {
          await taskActions.completeTask(subtaskId)
          dispatch('completed', { id: subtaskId, isSubtask: true })
        } catch (error) {
          console.error('サブタスク完了エラー:', error)
        } finally {
          completingSubtasks.delete(subtaskId)
          completingSubtasks = new Set(completingSubtasks)
        }
      }, 1500)
      
    } catch (error) {
      console.error('サブタスク完了エラー:', error)
      completingSubtasks.delete(subtaskId)
      completingSubtasks = new Set(completingSubtasks)
    }
  }

  // サブタスク未完了に戻す処理
  async function handleSubtaskUncomplete(subtaskId) {
    try {
      await taskActions.uncompleteTask(subtaskId)
      dispatch('uncompleted', { id: subtaskId, isSubtask: true })
    } catch (error) {
      console.error('サブタスク未完了エラー:', error)
    }
  }

  // 緊急性スコアの表示形式
  $: displayUrgencyScore = task.urgencyScore === Number.MAX_SAFE_INTEGER 
    ? '∞' 
    : task.urgencyScore.toFixed(1)

  // 工数の表示（サブタスク込み）
  $: displayEffort = task.total_effort_hours !== task.effort_hours 
    ? `${task.total_effort_hours.toFixed(1)}h (${task.effort_hours.toFixed(1)}h + ${(task.total_effort_hours - task.effort_hours).toFixed(1)}h)`
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

  // サブタスクの完了状況を計算
  $: subtaskStats = (() => {
    if (!task.subtasks || task.subtasks.length === 0 || task.parent_id !== null) {
      return null
    }
    
    const totalSubtasks = task.subtasks.length
    const completedSubtasks = task.subtasks.filter(subtask => subtask.status === 'done').length
    const activeSubtasks = totalSubtasks - completedSubtasks
    
    return {
      total: totalSubtasks,
      completed: completedSubtasks,
      active: activeSubtasks,
      canComplete: activeSubtasks === 0
    }
  })()

  // 親タスクの場合、すべてのサブタスクが完了しているかチェック
  $: canCompleteParentTask = !task.subtasks || task.subtasks.length === 0 || task.parent_id !== null || (subtaskStats && subtaskStats.canComplete)

  // タスク編集
  function handleEditTask() {
    taskActions.startEditTask(task)
    // フォームエリアまでスクロール
    document.querySelector('form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // サブタスク編集
  function handleEditSubtask(subtask) {
    taskActions.startEditTask(subtask)
    // フォームエリアまでスクロール
    document.querySelector('form')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
</script>

<div class="task-card {urgencyStyle} hover:shadow-lg transition-all cursor-pointer group relative {isCompletingWithAnimation ? 'duration-1000 opacity-0 scale-95 transform translate-x-4' : 'duration-200 opacity-100 scale-100 transform translate-x-0'}">
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
            {#if subtaskStats}
              <span class="ml-2 text-xs {subtaskStats.canComplete ? 'text-green-600' : 'text-orange-600'} font-medium">
                ({subtaskStats.completed}/{subtaskStats.total})
              </span>
            {/if}
            <span class="ml-2 text-xs text-gray-500">
              {showSubtasks ? '▲' : '▼'}
            </span>
          </button>
        </div>
      {/if}
    </div>

  </div>

  <!-- サブタスク一覧 -->
  {#if showSubtasks && task.subtasks && task.subtasks.length > 0}
    <div class="mt-4 space-y-3 relative z-20">
      {#each task.subtasks as subtask}
        <div class="border rounded-lg p-3 transition-all group/subtask
                    {completingSubtasks.has(subtask.id) 
                      ? 'duration-1000 opacity-0 scale-95 transform translate-x-4' 
                      : 'duration-200 opacity-100 scale-100 transform translate-x-0'}
                    {subtask.status === 'done'
                      ? 'bg-green-50 bg-opacity-90 border-green-200' 
                      : 'bg-white bg-opacity-80 border-gray-200 hover:shadow-sm'}">
          <div class="flex items-start justify-between">
            <div class="flex-1">
              <div class="font-medium mb-1 {subtask.status === 'done' ? 'text-gray-500 line-through' : 'text-gray-700'}">{subtask.name}</div>
              <div class="flex flex-wrap gap-2 text-xs">
                <span class="px-2 py-1 rounded-full {subtask.status === 'done' ? 'bg-gray-200 text-gray-500' : 'bg-gray-100 text-gray-600'}">
                  ⏱️ {subtask.effort_hours.toFixed(1)}h
                </span>
                <span class="px-2 py-1 rounded-full {subtask.status === 'done' ? 'bg-gray-200 text-gray-500' : getImportanceColor(subtask.importance)}">
                  ⭐ {subtask.importance}/5
                </span>
                {#if subtask.status === 'done'}
                  <span class="px-2 py-1 rounded-full bg-green-200 text-green-800 font-medium">
                    ✓ 完了済み
                  </span>
                {/if}
              </div>
            </div>
            <div class="ml-3 flex gap-2">
              {#if subtask.status === 'done'}
                <!-- 未完了に戻すボタン -->
                <button
                  type="button"
                  class="px-4 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 text-sm rounded-full transition-all duration-200 font-semibold shadow-sm hover:shadow-md hover:scale-105 opacity-0 group-hover/subtask:opacity-100"
                  on:click|stopPropagation={() => handleSubtaskUncomplete(subtask.id)}
                  title="サブタスクを未完了に戻す"
                >
                  <span class="flex items-center">
                    <span class="text-base mr-1">↺</span>
                    未完了に戻す
                  </span>
                </button>
              {:else}
                <!-- サブタスク編集ボタン -->
                <button
                  type="button"
                  class="px-3 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 text-xs rounded-full transition-all duration-200 font-medium shadow-sm hover:shadow-md opacity-0 group-hover/subtask:opacity-100"
                  on:click|stopPropagation={() => handleEditSubtask(subtask)}
                  title="サブタスクを編集"
                >
                  ✏️
                </button>
                <!-- サブタスク完了ボタン -->
                <button
                  type="button"
                  class="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 text-sm rounded-full transition-all duration-200 font-semibold shadow-sm hover:shadow-md hover:scale-105"
                  on:click|stopPropagation={() => handleSubtaskComplete(subtask.id)}
                  title="サブタスクを完了"
                >
                  <span class="flex items-center">
                    <span class="text-base mr-1">✓</span>
                    完了
                  </span>
                </button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <!-- アクションボタン群（右上・完了ボタンの横） -->
  <div class="absolute top-3 right-3 z-30 flex gap-2 opacity-0 group-hover:opacity-100">
    <!-- 編集ボタン -->
    <button
      type="button"
      class="px-3 py-1 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-full text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md"
      on:click|stopPropagation={handleEditTask}
      title="タスク編集"
    >
      ✏️
    </button>
    
    <!-- サブタスク追加ボタン（親タスクのみ） -->
    {#if !task.parent_id}
      <button
        type="button"
        class="px-3 py-1 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-full text-xs font-medium transition-all duration-200 shadow-sm hover:shadow-md"
        on:click|stopPropagation={handleAddSubtask}
        title="サブタスク追加"
      >
        ➕
      </button>
    {/if}

    <!-- 完了ボタン -->
    {#if canCompleteParentTask}
      <button
        type="button"
        class="px-6 py-3 bg-green-100 hover:bg-green-200 text-green-700 rounded-full text-base font-semibold transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
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
    {:else if subtaskStats}
      <!-- サブタスクの完了状況表示 -->
      <div class="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium shadow-md">
        サブタスク ({subtaskStats.completed}/{subtaskStats.total})
        {#if subtaskStats.active > 0}
          - あと{subtaskStats.active}件
        {/if}
      </div>
    {/if}
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