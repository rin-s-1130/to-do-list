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

  <!-- 3列タスクボード -->
  {#if $tasksByType}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {#each Object.entries(taskTypeConfig) as [type, config]}
        <div class="min-h-96">
          <!-- 列ヘッダー -->
          <div class="sticky top-0 z-10 {config.headerColor} px-4 py-3 rounded-t-lg border {config.borderColor}">
            <div class="flex items-center justify-between">
              <h3 class="font-semibold">
                {config.label}
              </h3>
              <span class="text-sm">
                {$tasksByType[type].length}件
              </span>
            </div>
          </div>

          <!-- タスクリスト -->
          <div class="min-h-80 {config.bgColor} border-l border-r border-b {config.borderColor} rounded-b-lg p-4 space-y-3">
            {#if $tasksByType[type].length === 0}
              <div class="text-center py-8 text-gray-500">
                <div class="text-4xl mb-2">📝</div>
                <p class="text-sm">タスクがありません</p>
              </div>
            {:else}
              {#each $tasksByType[type] as task (task.id)}
                <div class="fade-in">
                  <TaskCard {task} />
                </div>
              {/each}
            {/if}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="flex justify-center py-12">
      <LoadingSpinner />
    </div>
  {/if}

  <!-- 統計情報 -->
  {#if $tasksByType}
    <div class="bg-gray-50 rounded-lg p-4">
      <h4 class="font-medium text-gray-900 mb-3">📊 タスク統計</h4>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
        <div class="text-center">
          <div class="font-bold text-lg">
            {$tasksByType.work.length + $tasksByType.home.length + $tasksByType.skill.length}
          </div>
          <div class="text-gray-600">総タスク数</div>
        </div>
        <div class="text-center">
          <div class="font-bold text-lg">
            {($tasksByType.work.reduce((sum, t) => sum + (t.total_effort_hours || t.effort_hours), 0) +
              $tasksByType.home.reduce((sum, t) => sum + (t.total_effort_hours || t.effort_hours), 0) +
              $tasksByType.skill.reduce((sum, t) => sum + (t.total_effort_hours || t.effort_hours), 0)).toFixed(1)}h
          </div>
          <div class="text-gray-600">総工数</div>
        </div>
        <div class="text-center">
          <div class="font-bold text-lg">
            {[...$tasksByType.work, ...$tasksByType.home, ...$tasksByType.skill]
              .filter(t => t.urgencyLevel === 'high').length}
          </div>
          <div class="text-gray-600">高緊急度</div>
        </div>
        <div class="text-center">
          <div class="font-bold text-lg">
            {[...$tasksByType.work, ...$tasksByType.home, ...$tasksByType.skill]
              .filter(t => {
                const dueDate = new Date(t.due_date)
                const tomorrow = new Date()
                tomorrow.setDate(tomorrow.getDate() + 1)
                return dueDate <= tomorrow
              }).length}
          </div>
          <div class="text-gray-600">明日まで</div>
        </div>
      </div>
    </div>
  {/if}
</div>