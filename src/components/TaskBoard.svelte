<script>
  import { tasksByType, taskActions, selectedTaskType, uiActions } from '../stores.js'
  import TaskCard from './TaskCard.svelte'
  import LoadingSpinner from './LoadingSpinner.svelte'

  const taskTypeConfig = {
    work: { 
      label: '💼 仕事', 
      bgColor: 'bg-blue-50', 
      borderColor: 'border-blue-200',
      headerColor: 'bg-blue-100 text-blue-800'
    },
    home: { 
      label: '🏠 家', 
      bgColor: 'bg-green-50', 
      borderColor: 'border-green-200',
      headerColor: 'bg-green-100 text-green-800'
    },
    skill: { 
      label: '📚 スキルアップ', 
      bgColor: 'bg-purple-50', 
      borderColor: 'border-purple-200',
      headerColor: 'bg-purple-100 text-purple-800'
    }
  }

  // タスクタイプフィルター
  function handleTypeFilter(type) {
    uiActions.setTaskTypeFilter(type)
  }
</script>

<div class="space-y-6">
  <!-- フィルターボタン -->
  <div class="flex flex-wrap gap-2">
    <button
      type="button"
      class="px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200
             {$selectedTaskType === 'all' 
               ? 'bg-gray-800 text-white' 
               : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
      on:click={() => handleTypeFilter('all')}
    >
      📋 すべて
    </button>
    
    {#each Object.entries(taskTypeConfig) as [type, config]}
      <button
        type="button"
        class="px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200
               {$selectedTaskType === type 
                 ? 'bg-gray-800 text-white' 
                 : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
        on:click={() => handleTypeFilter(type)}
      >
        {config.label}
      </button>
    {/each}
  </div>

  <!-- タスクボード（1列） -->
  {#if $tasksByType}
    {@const currentTasks = $selectedTaskType === 'all' 
      ? [...$tasksByType.work, ...$tasksByType.home, ...$tasksByType.skill]
          .sort((a, b) => b.urgencyScore - a.urgencyScore)
      : $tasksByType[$selectedTaskType]}
    
    <div class="max-w-4xl mx-auto">
      <!-- タスクリスト -->
      <div class="bg-white border border-gray-200 rounded-lg p-6">
        {#if currentTasks.length === 0}
          <div class="text-center py-12 text-gray-500">
            <div class="text-6xl mb-4">📝</div>
            <h3 class="text-lg font-medium text-gray-900 mb-2">タスクがありません</h3>
            <p class="text-sm">上のフォームから新しいタスクを追加してください</p>
          </div>
        {:else}
          <div class="space-y-4">
            {#each currentTasks as task (task.id)}
              <div class="fade-in">
                <TaskCard {task} />
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {:else}
    <div class="flex justify-center py-12">
      <LoadingSpinner />
    </div>
  {/if}

  <!-- 統計情報 -->
  {#if $tasksByType}
    {@const allTasks = [...$tasksByType.work, ...$tasksByType.home, ...$tasksByType.skill]}
    {@const currentViewTasks = $selectedTaskType === 'all' ? allTasks : $tasksByType[$selectedTaskType]}
    
    <div class="bg-gray-50 rounded-lg p-4 max-w-4xl mx-auto">
      <h4 class="font-medium text-gray-900 mb-3">📊 
        {$selectedTaskType === 'all' ? 'すべてのタスク' : taskTypeConfig[$selectedTaskType]?.label || 'タスク'}統計
      </h4>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div class="text-center">
          <div class="font-bold text-lg">
            {currentViewTasks.length}
          </div>
          <div class="text-gray-600">
            {$selectedTaskType === 'all' ? '総タスク数' : 'タスク数'}
          </div>
        </div>
        <div class="text-center">
          <div class="font-bold text-lg">
            {currentViewTasks.reduce((sum, t) => sum + (t.total_effort_hours || t.effort_hours), 0).toFixed(1)}h
          </div>
          <div class="text-gray-600">
            {$selectedTaskType === 'all' ? '総工数' : '工数'}
          </div>
        </div>
        <div class="text-center">
          <div class="font-bold text-lg">
            {currentViewTasks.filter(t => t.urgencyLevel === 'high').length}
          </div>
          <div class="text-gray-600">高緊急度</div>
        </div>
        <div class="text-center">
          <div class="font-bold text-lg">
            {currentViewTasks.filter(t => {
                const dueDate = new Date(t.due_date)
                const tomorrow = new Date()
                tomorrow.setDate(tomorrow.getDate() + 1)
                return dueDate <= tomorrow
              }).length}
          </div>
          <div class="text-gray-600">明日まで</div>
        </div>
      </div>
      
      {#if $selectedTaskType === 'all'}
        <!-- カテゴリ別内訳 -->
        <div class="mt-4 pt-4 border-t border-gray-200">
          <div class="grid grid-cols-3 gap-4 text-xs">
            <div class="text-center">
              <div class="text-blue-600 font-bold">{$tasksByType.work.length}</div>
              <div class="text-gray-600">💼 仕事</div>
            </div>
            <div class="text-center">
              <div class="text-green-600 font-bold">{$tasksByType.home.length}</div>
              <div class="text-gray-600">🏠 家</div>
            </div>
            <div class="text-center">
              <div class="text-purple-600 font-bold">{$tasksByType.skill.length}</div>
              <div class="text-gray-600">📚 スキル</div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>