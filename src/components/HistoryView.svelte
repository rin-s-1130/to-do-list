<script>
  import { onMount } from 'svelte'
  import { history, historyStats, historyActions, loading, taskActions } from '../stores.js'
  import LoadingSpinner from './LoadingSpinner.svelte'

  let startDate = ''
  let endDate = ''
  let filteredHistory = []
  let currentStats = null

  // 日付フィルタ用のデフォルト値
  const today = new Date()
  const oneMonthAgo = new Date(today)
  oneMonthAgo.setMonth(today.getMonth() - 1)
  
  $: {
    if (!startDate) startDate = oneMonthAgo.toISOString().split('T')[0]
    if (!endDate) endDate = today.toISOString().split('T')[0]
  }

  // 履歴の読み込み
  onMount(async () => {
    await historyActions.loadHistory()
  })

  // フィルタされた履歴（階層構造対応）
  $: if ($history) {
    filteredHistory = $history.filter(record => {
      if (!startDate && !endDate) return true
      
      const recordDate = record.completed_at.split('T')[0]
      
      if (startDate && recordDate < startDate) return false
      if (endDate && recordDate > endDate) return false
      
      return true
    })
  }

  // フィルタした期間の統計計算（階層構造対応）
  $: currentStats = (() => {
    if (filteredHistory.length === 0) {
      return {
        totalTasks: 0,
        totalEffort: 0,
        averageEffort: 0,
        byType: { work: 0, home: 0, skill: 0 },
        byDate: {}
      }
    }

    const stats = {
      totalTasks: 0,
      totalEffort: 0,
      byType: { work: 0, home: 0, skill: 0 },
      byDate: {}
    }

    filteredHistory.forEach(parentRecord => {
      // 親タスクをカウント
      stats.totalTasks += 1
      stats.totalEffort += parentRecord.effort_hours
      stats.byType[parentRecord.task_type] += parentRecord.effort_hours
      
      const date = parentRecord.completed_at.split('T')[0]
      stats.byDate[date] = (stats.byDate[date] || 0) + parentRecord.effort_hours

      // サブタスクがある場合はそれらもカウント
      if (parentRecord.subtasks) {
        parentRecord.subtasks.forEach(subtask => {
          stats.totalTasks += 1
          stats.totalEffort += subtask.effort_hours
          stats.byType[subtask.task_type] += subtask.effort_hours
          
          const subtaskDate = subtask.completed_at.split('T')[0]
          stats.byDate[subtaskDate] = (stats.byDate[subtaskDate] || 0) + subtask.effort_hours
        })
      }
    })

    stats.averageEffort = stats.totalTasks > 0 ? stats.totalEffort / stats.totalTasks : 0
    return stats
  })()

  // 日付フィルタの適用
  async function applyDateFilter() {
    await historyActions.loadHistory(
      startDate ? startDate + 'T00:00:00.000Z' : null,
      endDate ? endDate + 'T23:59:59.999Z' : null
    )
  }

  // フィルタリセット
  function resetFilter() {
    startDate = ''
    endDate = ''
    historyActions.loadHistory()
  }

  // タスクタイプのアイコン
  function getTaskTypeInfo(type) {
    const typeMap = {
      work: { icon: '💼', label: '仕事', color: 'text-blue-600' },
      home: { icon: '🏠', label: '家', color: 'text-green-600' },
      skill: { icon: '📚', label: 'スキルアップ', color: 'text-purple-600' }
    }
    return typeMap[type] || { icon: '📋', label: 'その他', color: 'text-gray-600' }
  }

  // 日付の表示形式
  function formatDate(isoString) {
    const date = new Date(isoString)
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // サブタスクの表示状態管理
  let expandedTasks = new Set()
  let fadingOutTasks = new Set()
  
  function toggleSubtasks(taskId) {
    if (expandedTasks.has(taskId)) {
      expandedTasks.delete(taskId)
    } else {
      expandedTasks.add(taskId)
    }
    expandedTasks = new Set(expandedTasks) // リアクティブ更新のため
  }

  // タスクを未完了に戻す
  async function handleRestoreTask(taskId, taskName) {
    try {
      // フェードアウトアニメーション開始
      fadingOutTasks.add(taskId)
      fadingOutTasks = new Set(fadingOutTasks)
      
      // 1.5秒後にタスクを復元
      setTimeout(async () => {
        await taskActions.uncompleteTask(taskId)
        // 履歴を再読み込み
        await historyActions.loadHistory()
        // フェードアウト状態をクリア
        fadingOutTasks.delete(taskId)
        fadingOutTasks = new Set(fadingOutTasks)
      }, 1500)
      
    } catch (error) {
      console.error('タスク復元エラー:', error)
      alert('タスクの復元に失敗しました')
      // エラー時はフェードアウト状態をクリア
      fadingOutTasks.delete(taskId)
      fadingOutTasks = new Set(fadingOutTasks)
    }
  }
</script>

<div class="space-y-6">
  <div class="flex items-center justify-between">
    <h2 class="text-xl font-bold text-gray-900">📊 完了履歴</h2>
    
    <!-- 日付フィルタ -->
    <div class="flex items-center space-x-3">
      <div class="flex items-center space-x-2">
        <label for="start-date" class="text-sm text-gray-600">開始:</label>
        <input
          id="start-date"
          type="date"
          class="text-sm border border-gray-300 rounded px-2 py-1"
          bind:value={startDate}
        />
      </div>
      <div class="flex items-center space-x-2">
        <label for="end-date" class="text-sm text-gray-600">終了:</label>
        <input
          id="end-date"
          type="date"
          class="text-sm border border-gray-300 rounded px-2 py-1"
          bind:value={endDate}
        />
      </div>
      <button
        type="button"
        class="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
        on:click={applyDateFilter}
      >
        適用
      </button>
      <button
        type="button"
        class="px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700 transition-colors"
        on:click={resetFilter}
      >
        リセット
      </button>
    </div>
  </div>

  <!-- 統計サマリー -->
  {#if currentStats}
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 text-center">
        <div class="text-2xl font-bold text-blue-600">{currentStats.totalTasks}</div>
        <div class="text-sm text-blue-700">完了タスク数</div>
      </div>
      <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
        <div class="text-2xl font-bold text-green-600">{currentStats.totalEffort.toFixed(1)}h</div>
        <div class="text-sm text-green-700">総工数</div>
      </div>
      <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
        <div class="text-2xl font-bold text-amber-600">{currentStats.averageEffort.toFixed(1)}h</div>
        <div class="text-sm text-amber-700">平均工数</div>
      </div>
      <div class="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
        <div class="text-2xl font-bold text-purple-600">{Object.keys(currentStats.byDate).length}</div>
        <div class="text-sm text-purple-700">作業日数</div>
      </div>
    </div>

    <!-- タスクタイプ別統計 -->
    <div class="bg-gray-50 rounded-lg p-4">
      <h3 class="font-medium text-gray-900 mb-3">📈 カテゴリ別工数</h3>
      <div class="grid grid-cols-3 gap-4">
        {#each Object.entries(currentStats.byType) as [type, hours]}
          {@const typeInfo = getTaskTypeInfo(type)}
          <div class="text-center">
            <div class="text-2xl mb-1">{typeInfo.icon}</div>
            <div class="font-bold {typeInfo.color}">{hours.toFixed(1)}h</div>
            <div class="text-sm text-gray-600">{typeInfo.label}</div>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- 履歴リスト -->
  {#if $loading}
    <div class="flex justify-center py-12">
      <LoadingSpinner />
    </div>
  {:else if filteredHistory.length === 0}
    <div class="text-center py-12">
      <div class="text-4xl mb-4">📝</div>
      <p class="text-gray-500">指定期間内に完了したタスクはありません</p>
    </div>
  {:else}
    <div class="space-y-3">
      <h3 class="font-medium text-gray-900">📋 完了タスク一覧 ({filteredHistory.length}件の親タスク・独立タスク)</h3>
      
      <div class="space-y-3 max-h-96 overflow-y-auto scrollable">
        {#each filteredHistory as parentRecord (parentRecord.id)}
          {@const typeInfo = getTaskTypeInfo(parentRecord.task_type)}
          
          <!-- 親タスク・独立タスク -->
          <div class="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-all duration-1000 group {fadingOutTasks.has(parentRecord.task_id) ? 'opacity-0 scale-95 transform translate-x-4' : 'opacity-100 scale-100 transform translate-x-0'}">
            <!-- 親タスク本体 -->
            <div class="p-4">
              <div class="flex items-start justify-between">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center space-x-2">
                    <span class="text-lg">{typeInfo.icon}</span>
                    <h4 class="font-medium text-gray-900 truncate">{parentRecord.task_name}</h4>
                    {#if parentRecord.subtasks && parentRecord.subtasks.length > 0}
                      <button
                        type="button"
                        class="text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 px-3 py-1 rounded-full font-medium transition-colors"
                        on:click|stopPropagation={() => toggleSubtasks(parentRecord.task_id)}
                        title="サブタスクを表示/非表示"
                      >
                        📁 サブタスク {parentRecord.subtasks.length}件
                        <span class="ml-1 text-xs">
                          {expandedTasks.has(parentRecord.task_id) ? '▲' : '▼'}
                        </span>
                      </button>
                    {/if}
                  </div>
                  
                  <div class="mt-1 text-sm text-gray-500">
                    完了日時: {formatDate(parentRecord.completed_at)}
                  </div>
                </div>
                
                <div class="flex items-center gap-3">
                  <!-- 未完了に戻すボタン -->
                  <button
                    type="button"
                    class="px-3 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs rounded-full font-medium transition-all duration-200 shadow-sm hover:shadow-md opacity-0 group-hover:opacity-100"
                    on:click={() => handleRestoreTask(parentRecord.task_id, parentRecord.task_name)}
                    title="未完了に戻す"
                  >
                    ↺ 復元
                  </button>
                  
                  <div class="text-right">
                    <div class="text-lg font-bold text-gray-900">{parentRecord.effort_hours.toFixed(1)}h</div>
                    <div class="text-sm {typeInfo.color}">{typeInfo.label}</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- サブタスク一覧（展開時のみ表示） -->
            {#if parentRecord.subtasks && parentRecord.subtasks.length > 0 && expandedTasks.has(parentRecord.task_id)}
              <div class="bg-gray-50 border-t border-gray-100">
                <div class="px-4 py-3">
                  <div class="text-sm font-medium text-gray-700 mb-3">📂 サブタスク履歴</div>
                  <div class="space-y-2">
                    {#each parentRecord.subtasks as subtask (subtask.id)}
                      {@const subtaskTypeInfo = getTaskTypeInfo(subtask.task_type)}
                      <div class="bg-white rounded-md p-3 border border-gray-200 group/subtask hover:shadow-sm transition-shadow">
                        <div class="flex items-start justify-between">
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center space-x-2">
                              <span class="text-sm">{subtaskTypeInfo.icon}</span>
                              <span class="text-sm font-medium text-gray-800">{subtask.task_name}</span>
                            </div>
                            <div class="mt-1 text-xs text-gray-500">
                              完了日時: {formatDate(subtask.completed_at)}
                            </div>
                          </div>
                          
                          <div class="flex items-center gap-2">
                            <!-- サブタスク復元ボタン -->
                            <button
                              type="button"
                              class="px-2 py-1 bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs rounded-full font-medium transition-all duration-200 shadow-sm hover:shadow-md opacity-0 group-hover/subtask:opacity-100"
                              on:click={() => handleRestoreTask(subtask.task_id, subtask.task_name)}
                              title="サブタスクを未完了に戻す"
                            >
                              ↺
                            </button>
                            
                            <div class="text-right">
                              <div class="text-sm font-bold text-gray-900">{subtask.effort_hours.toFixed(1)}h</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    {/each}
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>